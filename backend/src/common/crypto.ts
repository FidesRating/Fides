import { createHash, randomBytes } from 'crypto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** URL-safe random token. Only its hash is stored in the database. */
export const randomToken = (prefix: string, bytes = 24) => `${prefix}_${randomBytes(bytes).toString('base64url')}`;
