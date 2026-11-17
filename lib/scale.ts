// Display-only copy of the published scale (brief: "Skala rating"). Scoring itself lives in the backend.
export interface ScaleRow {
  rating: string;
  score: string;
  band: 't' | 's' | 'd' | 'n';
  meaning: string;
  cut?: boolean;
}

export const SCALE_ROWS: ScaleRow[] = [
  { rating: 'AAA', score: '≥ 90', band: 't', meaning: 'Highest credibility. Calls consistently accurate, every promotion disclosed, wallets match the words.' },
  { rating: 'AA+', score: '85', band: 't', meaning: 'Very trustworthy, with minor weaknesses.' },
  { rating: 'AA', score: '81', band: 't', meaning: 'Very trustworthy, with minor weaknesses.' },
  { rating: 'AA−', score: '78', band: 't', meaning: 'Very trustworthy, with minor weaknesses.' },
  { rating: 'A+', score: '75', band: 't', meaning: 'Trustworthy, with clear weaknesses.' },
  { rating: 'A', score: '72', band: 't', meaning: 'Trustworthy, with clear weaknesses.' },
  { rating: 'A−', score: '69', band: 't', meaning: 'Trustworthy, with clear weaknesses.' },
  { rating: 'BBB+', score: '66', band: 't', meaning: 'Adequately trustworthy.' },
  { rating: 'BBB', score: '63', band: 't', meaning: 'Adequately trustworthy.' },
  { rating: 'BBB−', score: '60', band: 't', meaning: 'Adequately trustworthy. Lowest Trusted grade.', cut: true },
  { rating: 'BB+', score: '56', band: 's', meaning: 'Speculative. Accuracy or disclosure problems.' },
  { rating: 'BB', score: '52', band: 's', meaning: 'Speculative. Accuracy or disclosure problems.' },
  { rating: 'BB−', score: '48', band: 's', meaning: 'Speculative. Accuracy or disclosure problems.' },
  { rating: 'B+', score: '44', band: 's', meaning: 'Highly speculative.' },
  { rating: 'B', score: '40', band: 's', meaning: 'Highly speculative.' },
  { rating: 'B−', score: '36', band: 's', meaning: 'Highly speculative.' },
  { rating: 'CCC+', score: '30', band: 's', meaning: 'High risk. Also the mandatory ceiling after promoting a proven rug.' },
  { rating: 'CCC', score: '24', band: 's', meaning: 'High risk.' },
  { rating: 'CCC−', score: '18', band: 's', meaning: 'High risk.' },
  { rating: 'CC', score: '12', band: 's', meaning: 'Very high risk.' },
  { rating: 'C', score: '< 12', band: 's', meaning: 'Almost no basis for trust.' },
  { rating: 'D', score: 'n/a', band: 'd', meaning: 'Default on trust: a proven undisclosed paid promotion and a sale of at least 50% of that token from a declared wallet within 7 days of the call.' },
  { rating: 'NR', score: 'n/a', band: 'n', meaning: 'Not Rated: fewer than 20 measurable calls, or the rating was withdrawn.' },
];

export const BAND_NAME = { t: 'Trusted grade', s: 'Speculative grade', d: 'Default on trust', n: 'Not rated' } as const;

import type { Band } from './api';

/** Band of a rating code as returned by the API (ASCII minus) or shown in the UI (typographic minus). */
export function bandOfRating(rating: string): Band {
  const r = rating.replace('−', '-');
  if (r === 'NR') return 'not_rated';
  if (r === 'D') return 'default';
  const i = SCALE_ROWS.findIndex((x) => x.rating.replace('−', '-') === r);
  return i >= 0 && SCALE_ROWS[i].band === 't' ? 'trusted' : 'speculative';
}
