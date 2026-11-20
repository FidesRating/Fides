import { Prisma } from '@prisma/client';
import { band } from '../rating/rating.engine';
import { DISCLAIMER, OUTLOOK_TEXT, PILLARS, RULES, WATCH_TEXT } from '../rating/methodology';
import { activeWatch } from '../rating/watch';

export const formatActionId = (n: number) => `RA-${String(n).padStart(4, '0')}`;
export const num = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? null : Number(v.toString()));

/** Why an account is Not Rated, from the call count stored with the action. Null when the count is unknown or already meets the minimum. */
export function notRatedReason(rating: string | null, inputs: unknown): string | null {
  const total = (inputs as { totalCalls?: number } | null)?.totalCalls;
  if (rating !== 'NR' || typeof total !== 'number' || total >= RULES.minCalls) return null;
  return `${total} of ${RULES.minCalls} calls recorded`;
}

/** Public part of one rating action. Never contains committee votes, analyst names or raw internal inputs. */
export function presentAction(a: Prisma.RatingActionGetPayload<{ include: { reply: true } }>, previousRating?: string | null) {
  const pillars = a.accuracy === null ? null : PILLARS.map((p) => ({ key: p.key, label: p.label, weight: p.weight, score: (a as any)[p.key] as number }));
  const inputs = (a.inputs ?? {}) as Record<string, number | null>;
  const watch = activeWatch(a);
  return {
    actionId: formatActionId(a.actionNumber),
    type: a.type,
    rating: a.rating,
    band: a.rating ? band(a.rating) : null,
    previousRating: previousRating ?? null,
    outlook: a.outlook,
    outlookText: a.outlook ? OUTLOOK_TEXT[a.outlook] : null,
    watch,
    watchText: watch ? WATCH_TEXT[watch] : null,
    watchReason: watch ? a.watchReason : null,
    scorecard: {
      totalScore: a.totalScore,
      indicatedRating: a.indicatedRating,
      scorecardRating: a.scorecardRating,
      appliedCaps: a.appliedCaps,
      measurableCalls: a.measurableCalls,
      notRatedReason: notRatedReason(a.rating, a.inputs),
      hitRate: inputs.hitRate ?? null,
      medianExcess30d: inputs.medianExcess30d ?? null,
      pillars,
      differsFromScorecard: !!a.rating && a.rating !== a.scorecardRating,
    },
    rationale: a.rationale,
    methodologyVersion: a.methodologyVersion,
    publishedAt: a.publishedAt,
    reply: a.reply ? { body: a.reply.body, at: a.reply.updatedAt } : null,
    disclaimer: DISCLAIMER,
  };
}
