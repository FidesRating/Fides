/**
 * FIDES Methodology v1.0: single source of truth for the scale, pillars, automatic rules and the committee.
 * The scale is modelled on the letter scales used by credit rating agencies (AAA–D), with Outlook and Rating Watch.
 */
export const METHODOLOGY_VERSION = '1.0';

/** 21 grades, best to worst, with the minimum scorecard score. */
export const SCALE: { rating: string; minScore: number }[] = [
  { rating: 'AAA', minScore: 90 },
  { rating: 'AA+', minScore: 85 },
  { rating: 'AA', minScore: 81 },
  { rating: 'AA-', minScore: 78 },
  { rating: 'A+', minScore: 75 },
  { rating: 'A', minScore: 72 },
  { rating: 'A-', minScore: 69 },
  { rating: 'BBB+', minScore: 66 },
  { rating: 'BBB', minScore: 63 },
  { rating: 'BBB-', minScore: 60 },
  { rating: 'BB+', minScore: 56 },
  { rating: 'BB', minScore: 52 },
  { rating: 'BB-', minScore: 48 },
  { rating: 'B+', minScore: 44 },
  { rating: 'B', minScore: 40 },
  { rating: 'B-', minScore: 36 },
  { rating: 'CCC+', minScore: 30 },
  { rating: 'CCC', minScore: 24 },
  { rating: 'CCC-', minScore: 18 },
  { rating: 'CC', minScore: 12 },
  { rating: 'C', minScore: 0 },
];

export const DEFAULT_RATING = 'D';
export const NOT_RATED = 'NR';
export const LETTER_RATINGS = SCALE.map((s) => s.rating);
export const ALL_RATINGS = [...LETTER_RATINGS, DEFAULT_RATING, NOT_RATED];
export const TRUSTED_FLOOR = 'BBB-';

export const PILLARS = [
  { key: 'accuracy', label: 'Call Accuracy', weight: 0.35 },
  { key: 'disclosure', label: 'Disclosure', weight: 0.25 },
  { key: 'walletAlignment', label: 'Wallet Alignment', weight: 0.25 },
  { key: 'conduct', label: 'Conduct', weight: 0.15 },
] as const;
export type PillarKey = (typeof PILLARS)[number]['key'];

export const RULES = {
  minMeasurableCalls: 15,
  measureAfterDays: 30,
  dumpSoldPct: 0.5,
  dumpWindowDays: 7,
  rugLookbackMonths: 12,
  rugCap: 'CCC+',
  noWalletCap: 'A',
  noDataPillarScore: 50,
  minFollowers: 10_000, // The brief rejects accounts below 10,000 followers. Keep it equal to MIN_FOLLOWERS in components/staff/shared.tsx.
  minCommitteeVotes: 3,
  maxNotchesFromScorecard: 1,
  noticeHours: 48,
  appealDays: 14,
  fullReviewDays: 180,
  watchMaxDays: 90,
  outlookDelta: 5,
  developingDelta: 10,
};

export const OUTLOOK_TEXT = {
  positive: 'The rating may rise over the next 6–24 months.',
  stable: 'The rating is expected to hold.',
  negative: 'The rating may fall over the next 6–24 months.',
  developing: 'Some pillars are improving and others weakening; direction is unclear.',
};

export const WATCH_TEXT = {
  watch_positive: 'A specific event under review may raise the rating. Resolved within 90 days.',
  watch_negative: 'A specific event under review may lower the rating. Resolved within 90 days.',
  watch_evolving: 'A specific event is under review and its direction is not yet clear.',
};

export const DISCLAIMER =
  'FIDES ratings are opinions based on public data and a published methodology. They are not statements of fact, not regulated credit ratings, and not investment advice.';

export function assertMethodology() {
  const w = PILLARS.reduce((s, p) => s + p.weight, 0);
  if (Math.abs(w - 1) > 1e-9) throw new Error(`Methodology: pillar weights total ${w}, expected 1`);
  for (let i = 1; i < SCALE.length; i++) {
    if (SCALE[i].minScore >= SCALE[i - 1].minScore) throw new Error('Methodology: scale thresholds must decrease');
  }
}
