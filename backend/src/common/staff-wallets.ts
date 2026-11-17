import { StaffRole } from '@prisma/client';
import { isValidSolanaAddress } from './wallet-signature';

const ROLES: readonly StaffRole[] = ['analyst', 'committee', 'admin'];

/**
 * Parses the owner-managed staff allowlist: `STAFF_WALLETS="<address>:<role>,<address>:<role>"`.
 * Roles come only from this list, never from token ownership. An unset or empty value means no staff
 * (fail closed). A malformed entry throws so a typo can never silently grant or hide access.
 */
export function parseStaffWallets(raw: string | undefined): Map<string, StaffRole> {
  const out = new Map<string, StaffRole>();
  for (const entry of (raw ?? '').split(',').map((e) => e.trim()).filter(Boolean)) {
    const [address, role, ...rest] = entry.split(':').map((p) => p.trim());
    if (rest.length || !address || !isValidSolanaAddress(address)) throw new Error('STAFF_WALLETS has an invalid wallet address');
    if (!ROLES.includes(role as StaffRole)) throw new Error(`STAFF_WALLETS has an invalid role for ${address.slice(0, 6)}...`);
    if (out.has(address)) throw new Error(`STAFF_WALLETS lists ${address.slice(0, 6)}... twice`);
    out.set(address, role as StaffRole);
  }
  return out;
}
