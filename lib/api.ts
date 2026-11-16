// Typed client for the public FIDES API. Every call fails soft (null) so pages render empty states.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const REVALIDATE_SECONDS = 120;

export type Band = 'trusted' | 'speculative' | 'default' | 'not_rated';
export type ActionType = 'new' | 'upgrade' | 'downgrade' | 'affirm' | 'withdraw';

export interface Stats {
  accountsRated: number;
  callsTracked: number;
  ratingActions: number;
  aaaRatings: number;
}

export interface RatingAction {
  actionId: string;
  type: ActionType;
  handle: string;
  displayName: string | null;
  rating: string | null;
  previousRating: string | null;
  outlook: string | null;
  watch: string | null;
  publishedAt: string;
}

export interface RatingListItem {
  handle: string;
  displayName: string | null;
  followers: number;
  participating: boolean;
  rating: string;
  band: Band;
  outlook: string | null;
  watch: string | null;
  totalScore: number | null;
  weakestPillar: string | null;
  lastAction: { type: ActionType; previousRating: string | null; publishedAt: string };
}

export interface UnderReviewItem {
  handle: string;
  displayName: string | null;
  stage: 'Scorecard' | 'Committee' | 'Notice period';
  since: string;
}

export interface ResearchItem {
  slug: string;
  kind: string;
  title: string;
  standfirst: string | null;
  readMinutes: number | null;
  publishedAt: string;
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const getStats = () => get<Stats>('/stats');
export const getActions = (limit = 12) => get<RatingAction[]>(`/actions?limit=${limit}`);
export const getRatings = () => get<RatingListItem[]>('/ratings');
export const getUnderReview = () => get<UnderReviewItem[]>('/under-review');
export const getResearch = () => get<ResearchItem[]>('/research');

// ───────────── Rating report ─────────────

export interface Snapshot {
  sourceUrl: string;
  archiveUrl: string | null;
  contentHash: string;
  capturedAt: string;
}

export interface Pillar {
  key: string;
  label: string;
  weight: number;
  score: number;
}

export interface RatingDetail {
  actionId: string;
  type: ActionType;
  rating: string | null;
  band: Band | null;
  previousRating: string | null;
  outlook: string | null;
  outlookText: string | null;
  watch: string | null;
  watchText: string | null;
  watchReason: string | null;
  scorecard: {
    totalScore: number | null;
    indicatedRating: string | null;
    scorecardRating: string | null;
    appliedCaps: string[];
    measurableCalls: number;
    hitRate: number | null;
    medianExcess30d: number | null;
    pillars: Pillar[] | null;
    differsFromScorecard: boolean;
  };
  rationale: string | null;
  methodologyVersion: string;
  publishedAt: string;
  reply: { body: string; at: string } | null;
}

export interface CallRow {
  postedAt: string;
  token: string;
  chain: string | null;
  direction: 'long' | 'short';
  postUrl: string | null;
  archiveUrl: string | null;
  deleted: boolean;
  return7d: number | null;
  return30d: number | null;
  return90d: number | null;
  excessVsBtc30d: number | null;
  sponsoredDisclosed: boolean;
  paidPromotion: 'disclosed' | 'undisclosed' | null;
  rugConfirmed: boolean;
  retracted: boolean;
  priceSource: string;
  snapshots: Snapshot[];
}

export interface HistoryRow {
  actionId: string;
  type: ActionType;
  rating: string | null;
  previousRating: string | null;
  outlook: string | null;
  watch: string | null;
  totalScore: number | null;
  publishedAt: string;
  current: boolean;
}

export interface Report {
  account: {
    handle: string;
    displayName: string | null;
    followers: number;
    accounts: { platform: string; handle: string; followers: number }[];
    coverage: 'Participating' | 'Unsolicited';
    underReview: boolean;
  };
  rating: RatingDetail;
  nextFullReview: string;
  evidence: {
    wallets: { chain: string; chainName: string; address: string; method: string; sourceUrl: string | null; explorerUrl: string | null }[];
    paidPromotions: { source: string; evidenceUrl: string; disclosed: boolean; call: { token: string; postedAt: string } | null; snapshots: Snapshot[] }[];
  };
  calls: { total: number; shown: number; fullAccess: boolean; items: CallRow[] };
  history: HistoryRow[];
  disclaimer: string;
}

export type Fetched<T> = { state: 'ok'; data: T } | { state: 'gone' } | { state: 'notfound' } | { state: 'error' };

async function getStatus<T>(path: string): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
    if (res.status === 410) return { state: 'gone' };
    if (res.status === 404) return { state: 'notfound' };
    return res.ok ? { state: 'ok', data: (await res.json()) as T } : { state: 'error' };
  } catch {
    return { state: 'error' };
  }
}

const enc = encodeURIComponent;
export const getReport = (handle: string) => getStatus<Report>(`/ratings/${enc(handle)}`);
export const getHistory = (handle: string) => getStatus<HistoryRow[]>(`/ratings/${enc(handle)}/history`);

export interface RatingFilters {
  band?: string;
  rating?: string;
  outlook?: string;
  watch?: string;
  sort?: string;
}

export const getFilteredRatings = (f: RatingFilters) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
  return get<RatingListItem[]>(`/ratings${q.size ? `?${q}` : ''}`);
};
