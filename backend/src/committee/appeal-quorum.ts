/**
 * Rejecting an appeal needs the same quorum as a rating: at least `min` distinct committee members
 * who have no declared conflict with the appealing account. Conflicted votes never count.
 */
export function rejectQuorumReached(voterIds: string[], conflictedIds: Set<string>, min: number): boolean {
  return new Set(voterIds.filter((id) => !conflictedIds.has(id))).size >= min;
}
