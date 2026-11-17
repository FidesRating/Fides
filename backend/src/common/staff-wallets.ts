import { StaffRole } from '@prisma/client';
import { isValidEvmAddress, normalizeEvmAddress } from './wallet-signature';

const ROLES: readonly StaffRole[] = ['analyst', 'committee', 'admin'];

/**
 * Parses the owner-managed staff allowlist: `STAFF_WALLETS="<0x address>:<role>,<0x address>:<role>"`.
 * Addresses are EVM and are matched in lowercase. Roles come only from this list, never from token ownership.
 * An unset or empty value means no staff (fail closed). A malformed entry throws so a typo can never
 * silently grant or hide access.
 */
export function parseStaffWallets(raw: string | undefined): Map<string, StaffRole> {
  const out = new Map<string, StaffRole>();
  for (const entry of (raw ?? '').split(',').map((e) => e.trim()).filter(Boolean)) {
    const [rawAddress, role, ...rest] = entry.split(':').map((p) => p.trim());
    if (rest.length || !rawAddress || !isValidEvmAddress(rawAddress)) throw new Error('STAFF_WALLETS has an invalid wallet address');
    const address = normalizeEvmAddress(rawAddress);
    if (!ROLES.includes(role as StaffRole)) throw new Error(`STAFF_WALLETS has an invalid role for ${address.slice(0, 8)}...`);
    if (out.has(address)) throw new Error(`STAFF_WALLETS lists ${address.slice(0, 8)}... twice`);
    out.set(address, role as StaffRole);
  }
  return out;
}
