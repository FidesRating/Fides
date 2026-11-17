import { Watch } from '@prisma/client';
import { RULES } from './methodology';

interface WatchState {
  watch: Watch | null;
  watchSetAt: Date | null;
}

const DAY_MS = 86400_000;

/** A Rating Watch is shown for at most RULES.watchMaxDays (90) days, even if staff never clear it. */
export function activeWatch(a: WatchState, now = new Date()): Watch | null {
  if (!a.watch || !a.watchSetAt) return null;
  return now.getTime() - a.watchSetAt.getTime() < RULES.watchMaxDays * DAY_MS ? a.watch : null;
}

/**
 * Start time for a watch being set now. A watch that is still running keeps its original start, so editing
 * it never extends the 90 days. Returns null when the period already ended: it cannot be set again on the
 * same rating action.
 */
export function watchStart(current: WatchState, now = new Date()): Date | null {
  if (!current.watch || !current.watchSetAt) return now;
  return activeWatch(current, now) ? current.watchSetAt : null;
}
