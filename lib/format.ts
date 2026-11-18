import type { Band } from './api';

// The API uses ASCII "-" in rating codes; the UI shows the typographic minus.
export const formatRating = (r: string | null) => (r ? r.replace('-', '−') : 'n/a');

export const OUTLOOK: Record<string, { arrow: string; label: string; tone: 'pos' | 'neg' | 'dev' | '' }> = {
  positive: { arrow: '↑', label: 'Positive', tone: 'pos' },
  stable: { arrow: '→', label: 'Stable', tone: '' },
  negative: { arrow: '↓', label: 'Negative', tone: 'neg' },
  developing: { arrow: '↕', label: 'Developing', tone: 'dev' },
};

/** Backend values are watch_positive | watch_negative | watch_evolving. */
export const watchLabel = (w: string) => `Watch ${w.replace('watch_', '').replace(/^./, (c) => c.toUpperCase())}`;

export const BAND_CLASS: Record<Band, 't' | 's' | 'd' | 'n'> = {
  trusted: 't',
  speculative: 's',
  default: 'd',
  not_rated: 'n',
};

export const BAND_LABEL: Record<Band, string> = {
  trusted: 'Trusted grade',
  speculative: 'Speculative grade',
  default: 'Default',
  not_rated: 'Not rated',
};

export const ACTION_LABEL: Record<string, string> = {
  new: 'NEW',
  upgrade: 'UPGRADE',
  downgrade: 'DOWNGRADE',
  affirm: 'AFFIRMED',
  withdraw: 'WITHDRAWN',
};

export const ACTION_CLASS: Record<string, string> = {
  new: 'new',
  upgrade: 'up',
  downgrade: 'down',
  affirm: 'aff',
  withdraw: 'aff',
};

/**
 * The profile picture is shown only when it comes from X's image host. A staff-entered link to any other site is ignored,
 * so a public page never loads an arbitrary third-party image.
 */
export function safeAvatarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname === 'pbs.twimg.com' && u.pathname.startsWith('/profile_images/') ? u.toString() : null;
  } catch {
    return null;
  }
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
