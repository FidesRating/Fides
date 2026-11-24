import { createHmac } from 'crypto';
import { ZeroHash, id as keccakText } from 'ethers';

/**
 * Pure hashing rules for the on-chain registries. Only hashes ever leave the server: no raw ids, votes,
 * member identities or wallets. Anyone can recompute the rating hash from the public rating page.
 */

/** Public fields of a published rating action. Nothing private belongs here. */
export interface PublishedRatingFields {
  actionNumber: number;
  handle: string;
  rating: string;
  outlook: string | null;
  type: string | null;
  methodologyVersion: string;
  publishedAt: Date;
  rationale: string | null;
}

export const ratingRecordId = (actionNumber: number) => keccakText(`fides:rating:${actionNumber}`);
export const evidenceRecordId = (snapshotId: string) => keccakText(`fides:evidence:${snapshotId}`);
export const decisionRecordId = (actionNumber: number) => keccakText(`fides:decision:${actionNumber}`);

/** Canonical text: fixed field order, one pipe between fields, empty string for null. */
export function canonicalRating(f: PublishedRatingFields): string {
  return [
    'fides-rating-v1',
    f.actionNumber,
    f.handle.toLowerCase(),
    f.rating,
    f.outlook ?? '',
    f.type ?? '',
    f.methodologyVersion,
    f.publishedAt.toISOString(),
    f.rationale ?? '',
  ].join('|');
}

export const ratingContentHash = (f: PublishedRatingFields) => keccakText(canonicalRating(f));

/** Deterministic per-decision salt, so a retry produces the same hash and no salt has to be stored. */
export const decisionSalt = (secret: string, actionNumber: number) =>
  createHmac('sha256', secret).update(`fides:decision-salt:${actionNumber}`).digest('hex');

/**
 * Salted hash of the final decision. Only the final outcome and the count of counted votes go in.
 * Without the salt a few possible outcomes could be guessed from the hash.
 */
export function decisionContentHash(args: {
  secret: string;
  actionNumber: number;
  rating: string;
  outlook: string | null;
  countedVotes: number;
}): string {
  const salt = decisionSalt(args.secret, args.actionNumber);
  return keccakText(['fides-decision-v1', args.actionNumber, args.rating, args.outlook ?? '', args.countedVotes, salt].join('|'));
}

/** Zero when the rating equals the scorecard and no rationale was published (the contract allows zero here). */
export const rationaleHash = (rationale: string | null) => (rationale ? keccakText(rationale) : ZeroHash);

/** Takedown reason hash: the reason text stays in the database, only its hash goes on-chain. */
export const reasonHash = (reason: string) => keccakText(reason);

/** Evidence content hash is the sha256 already stored with the snapshot (64 hex characters). */
export function evidenceContentHash(sha256Hex: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(sha256Hex)) throw new Error('Evidence content hash must be 64 hex characters');
  return `0x${sha256Hex.toLowerCase()}`;
}
