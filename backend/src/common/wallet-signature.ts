import { BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

export type WalletKind = 'evm' | 'solana';

export function walletKind(address: string): WalletKind {
  return address.startsWith('0x') ? 'evm' : 'solana';
}

export function isValidEvmAddress(a: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(a.trim());
}

/** Login and staff addresses are stored lowercase so one wallet is always one row, whatever case the wallet app shows. */
export const normalizeEvmAddress = (a: string) => a.trim().toLowerCase();

export function isValidSolanaAddress(a: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.trim());
}

/**
 * Verifies a wallet message signature:
 * EVM via ethers.verifyMessage, Solana via ed25519 (tweetnacl).
 * A Solana signature may be hex (with or without 0x) or base58.
 */
export function verifyWalletSignature(address: string, message: string, signature: string): void {
  try {
    if (walletKind(address) === 'evm') {
      const recovered = ethers.verifyMessage(message, signature);
      if (recovered.toLowerCase() !== address.toLowerCase()) throw new Error('recovered address mismatch');
      return;
    }
    const sigBytes = /^(0x)?[0-9a-fA-F]+$/.test(signature)
      ? new Uint8Array(Buffer.from(signature.replace(/^0x/, ''), 'hex'))
      : bs58.decode(signature);
    const ok = nacl.sign.detached.verify(new TextEncoder().encode(message), sigBytes, bs58.decode(address));
    if (!ok) throw new Error('invalid ed25519 signature');
  } catch (err) {
    throw new BadRequestException(`Wallet signature verification failed: ${err.message}`);
  }
}
