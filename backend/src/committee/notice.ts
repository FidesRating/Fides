import { NoticeChannel } from '@prisma/client';

/** A proof is a public X post URL, e.g. https://x.com/FidesRating/status/1234567890. */
export function isXStatusUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'].includes(u.hostname)
      && /^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

interface NoticeState {
  status: string;
  noticeChannel: NoticeChannel | null;
  noticeProofUrl: string | null;
  publishAfter: Date | null;
}

/**
 * Returns the reason a rating cannot be published yet, or null when it can.
 * The notice clock for a claimed account starts at finalize. For an unclaimed account it starts only
 * when staff record proof of the X mention, so publishAfter stays empty until then.
 */
export function publishBlocker(a: NoticeState, now: Date): string | null {
  if (a.status !== 'notice') return `Only actions in the notice period can be published (action is ${a.status})`;
  if (a.noticeChannel === 'x_mention' && !a.noticeProofUrl) return 'The notice has not been delivered: record the X mention as proof first';
  if (!a.publishAfter) return 'The notice period has not started';
  if (a.publishAfter > now) return `The rated account has until ${a.publishAfter.toISOString()} to flag factual errors`;
  return null;
}
