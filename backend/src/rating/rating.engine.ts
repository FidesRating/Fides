import {
  DEFAULT_RATING, LETTER_RATINGS, NOT_RATED, PILLARS, PillarKey, RULES, SCALE, TRUSTED_FLOOR,
} from './methodology';

// ─────────────────────────── Scale helpers ───────────────────────────

/** Notch index: 0 = AAA … 20 = C, 21 = D. NR has no notch. */
export function notch(rating: string): number {
  if (rating === DEFAULT_RATING) return LETTER_RATINGS.length;
  const i = LETTER_RATINGS.indexOf(rating);
  if (i < 0) throw new Error(`Unknown rating ${rating}`);
  return i;
}

export const ratingAt = (n: number) => (n >= LETTER_RATINGS.length ? DEFAULT_RATING : LETTER_RATINGS.at(Math.max(0, n))!);

export function scoreToRating(score: number): string {
  return SCALE.find((s) => score >= s.minScore)!.rating;
}

export type Band = 'trusted' | 'speculative' | 'default' | 'not_rated';
export function band(rating: string): Band {
  if (rating === NOT_RATED) return 'not_rated';
  if (rating === DEFAULT_RATING) return 'default';
  return notch(rating) <= notch(TRUSTED_FLOOR) ? 'trusted' : 'speculative';
}

// ─────────────────────────── Scorecard ───────────────────────────────

export interface CallInput {
  id: string;
  postedAt: Date;
  direction: 'long' | 'short';
  priceAtCall: number | null;
  price30d: number | null;
  btcAtCall: number | null;
  btc30d: number | null;
  deleted: boolean;
  rugConfirmedAt: Date | null;
  retracted: boolean;
}

export interface ScorecardInput {
  now: Date;
  calls: CallInput[];
  /** Only paid promotions that are confirmed. */
  promotions: { callId: string | null; disclosed: boolean }[];
  /** Cek wallet terverifikasi per call. */
  walletChecks: { callId: string; heldAtCall: boolean; soldPct7d: number }[];
  verifiedWalletCount: number;
}

export interface ScorecardResult {
  notRated: boolean;
  isDefault: boolean;
  measurableCalls: number;
  pillars: Record<PillarKey, number> | null;
  totalScore: number | null;
  indicatedRating: string | null; // from the score, before caps
  scorecardRating: string; // after caps / D / NR
  appliedCaps: string[];
  inputs: {
    totalCalls: number;
    hitRate: number | null;
    medianExcess30d: number | null;
    confirmedPromotions: number;
    disclosedPromotions: number;
    eligibleWalletCalls: number;
    dumpedCalls: number;
    deletedCalls: number;
    rugsNotRetracted: number;
    rugsInLookback: number;
    verifiedWallets: number;
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s.at(m)! : (s.at(m - 1)! + s.at(m)!) / 2;
}

export function computeScorecard(input: ScorecardInput): ScorecardResult {
  const { now, calls } = input;
  const measureCutoff = now.getTime() - RULES.measureAfterDays * 86400_000;
  const measurable = calls.filter(
    (c) => c.priceAtCall !== null && c.btcAtCall !== null && c.price30d !== null && c.btc30d !== null && c.postedAt.getTime() <= measureCutoff && c.priceAtCall > 0 && c.btcAtCall > 0,
  );

  // Pillar 1: Call Accuracy
  const excess = measurable.map((c) => {
    const tokenRet = c.price30d! / c.priceAtCall! - 1;
    const btcRet = c.btc30d! / c.btcAtCall! - 1;
    return c.direction === 'long' ? tokenRet - btcRet : -tokenRet - -btcRet;
  });
  const hitRate = excess.length ? excess.filter((e) => e > 0).length / excess.length : null;
  const medianExcess = excess.length ? median(excess) : null;

  // Pillar 2: Disclosure
  const confirmed = input.promotions.length;
  const disclosed = input.promotions.filter((p) => p.disclosed).length;

  // Pillar 3: Wallet Alignment. A call counts as a dump when a wallet held the token and sold at least 50% within 7 days
  const heldByCall = new Map<string, boolean>();
  for (const w of input.walletChecks.filter((w) => w.heldAtCall)) {
    heldByCall.set(w.callId, (heldByCall.get(w.callId) ?? false) || w.soldPct7d >= RULES.dumpSoldPct);
  }
  const eligibleWalletCalls = heldByCall.size;
  const dumpedCalls = [...heldByCall.values()].filter(Boolean).length;

  // Pillar 4: Conduct
  const deletedCalls = calls.filter((c) => c.deleted).length;
  const rugs = calls.filter((c) => c.rugConfirmedAt && !c.retracted);
  const lookback = new Date(now);
  lookback.setUTCMonth(lookback.getUTCMonth() - RULES.rugLookbackMonths);
  const rugsInLookback = rugs.filter((c) => c.rugConfirmedAt! >= lookback).length;

  const inputs = {
    totalCalls: calls.length,
    hitRate: hitRate === null ? null : round1(hitRate * 100) / 100,
    medianExcess30d: medianExcess === null ? null : Math.round(medianExcess * 10000) / 10000,
    confirmedPromotions: confirmed,
    disclosedPromotions: disclosed,
    eligibleWalletCalls,
    dumpedCalls,
    deletedCalls,
    rugsNotRetracted: rugs.length,
    rugsInLookback,
    verifiedWallets: input.verifiedWalletCount,
  };

  // Default on trust: proven paid promotion, undisclosed, and a dump on the same call
  const undisclosedPaidCalls = new Set(input.promotions.filter((p) => !p.disclosed && p.callId).map((p) => p.callId!));
  const isDefault = [...undisclosedPaidCalls].some((id) => heldByCall.get(id) === true);

  if (calls.length < RULES.minCalls && !isDefault) {
    return {
      notRated: true, isDefault: false, measurableCalls: measurable.length, pillars: null, totalScore: null,
      indicatedRating: null, scorecardRating: NOT_RATED, appliedCaps: [], inputs,
    };
  }

  const pillars: Record<PillarKey, number> = {
    accuracy: hitRate === null ? RULES.noDataPillarScore : Math.round(100 * (0.6 * hitRate + 0.4 * clamp01(medianExcess! + 0.5))),
    disclosure: confirmed === 0 ? 100 : Math.round((100 * disclosed) / confirmed),
    walletAlignment:
      input.verifiedWalletCount === 0 || eligibleWalletCalls === 0
        ? RULES.noDataPillarScore
        : Math.round(100 * (1 - dumpedCalls / eligibleWalletCalls)),
    conduct: Math.round(Math.max(0, 100 - 150 * (calls.length ? deletedCalls / calls.length : 0) - 20 * rugs.length)),
  };
  const totalScore = Math.round(PILLARS.reduce((s, p) => s + pillars[p.key] * p.weight, 0) + 1e-9);
  const indicatedRating = scoreToRating(totalScore);

  if (isDefault) {
    return {
      notRated: false, isDefault: true, measurableCalls: measurable.length, pillars, totalScore, indicatedRating,
      scorecardRating: DEFAULT_RATING, appliedCaps: ['default_on_trust'], inputs,
    };
  }

  let n = notch(indicatedRating);
  const appliedCaps: string[] = [];
  if (rugsInLookback > 0 && n < notch(RULES.rugCap)) {
    n = notch(RULES.rugCap);
    appliedCaps.push('rug_cap');
  }
  if (input.verifiedWalletCount === 0 && n < notch(RULES.noWalletCap)) {
    n = notch(RULES.noWalletCap);
    appliedCaps.push('no_wallet_cap');
  }
  return {
    notRated: false, isDefault: false, measurableCalls: measurable.length, pillars, totalScore, indicatedRating,
    scorecardRating: ratingAt(n), appliedCaps, inputs,
  };
}

// ─────────────────────────── Committee ───────────────────────────────

/** Ratings a committee member may choose for this scorecard. */
export function allowedVotes(scorecardRating: string, appliedCaps: string[]): string[] {
  if (scorecardRating === NOT_RATED || scorecardRating === DEFAULT_RATING) return [scorecardRating];
  const n = notch(scorecardRating);
  // A cap is an upper bound: the committee may go below it, never above it.
  const best = appliedCaps.length ? n : Math.max(0, n - RULES.maxNotchesFromScorecard);
  const worst = Math.min(LETTER_RATINGS.length - 1, n + RULES.maxNotchesFromScorecard);
  return LETTER_RATINGS.slice(best, worst + 1);
}

/** Median vote. With an even count the more conservative (lower) rating wins. */
export function committeeRating(votes: string[]): string {
  if (!votes.length) throw new Error('No votes');
  if (votes.every((v) => v === NOT_RATED)) return NOT_RATED;
  const ns = votes.map(notch).sort((a, b) => a - b);
  return ratingAt(ns.at(Math.floor(ns.length / 2))!);
}

type OutlookT = 'positive' | 'stable' | 'negative' | 'developing';
const CONSERVATIVE: OutlookT[] = ['negative', 'developing', 'stable', 'positive'];

/** Mode of the outlooks; on a tie the most conservative wins. */
export function committeeOutlook(votes: OutlookT[]): OutlookT {
  const counts = new Map<OutlookT, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  const max = Math.max(...counts.values());
  return CONSERVATIVE.find((o) => counts.get(o) === max)!;
}

/** Suggested outlook from the score change since the last rating. */
export function suggestOutlook(
  current: { totalScore: number | null; pillars: Record<PillarKey, number> | null },
  previous: { totalScore: number | null; pillars: Record<PillarKey, number> | null } | null,
): OutlookT {
  if (!previous?.pillars || !current.pillars || previous.totalScore === null || current.totalScore === null) return 'stable';
  const deltas = PILLARS.map((p) => current.pillars![p.key] - previous.pillars![p.key]);
  if (deltas.some((d) => d >= RULES.developingDelta) && deltas.some((d) => d <= -RULES.developingDelta)) return 'developing';
  const d = current.totalScore - previous.totalScore;
  if (d >= RULES.outlookDelta) return 'positive';
  if (d <= -RULES.outlookDelta) return 'negative';
  return 'stable';
}

export function actionType(previousRating: string | null, newRating: string): 'new' | 'upgrade' | 'downgrade' | 'affirm' {
  if (!previousRating || previousRating === NOT_RATED || newRating === NOT_RATED) return previousRating === newRating ? 'affirm' : 'new';
  const a = notch(previousRating), b = notch(newRating);
  return b < a ? 'upgrade' : b > a ? 'downgrade' : 'affirm';
}
