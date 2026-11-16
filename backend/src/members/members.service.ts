import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Member, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { randomToken, sha256 } from '../common/crypto';
import { TokenGateService } from '../common/token-gate.service';
import { isValidSolanaAddress, verifyWalletSignature } from '../common/wallet-signature';

const NONCE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 86400_000;
const MAX_API_KEYS = 5;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService, private readonly gate: TokenGateService) {}

  /** Step 1 of holder login: a one-time message signed by a Solana wallet. No transaction. */
  async createNonce(walletAddress: string) {
    const wallet = walletAddress.trim();
    if (!isValidSolanaAddress(wallet)) throw new BadRequestException('Sign in with a Solana wallet');
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
    const message = [
      'Sign in to FIDES',
      `Wallet: ${wallet}`,
      `Nonce: ${nonce}`,
      `Expires: ${expiresAt.toISOString()}`,
      'This request will not trigger a transaction or cost any fees.',
    ].join('\n');
    await this.prisma.authNonce.create({ data: { walletAddress: wallet, nonce, purpose: 'login', message, expiresAt } });
    return { message, nonce, expiresAt };
  }

  async verifyLogin(walletAddress: string, nonce: string, signature: string) {
    await consumeNonce(this.prisma, walletAddress, nonce, signature, 'login');
    const wallet = walletAddress.trim();
    const member = await this.prisma.member.upsert({
      where: { walletAddress: wallet },
      create: { walletAddress: wallet },
      update: { lastSeenAt: new Date() },
    });
    await this.refreshBalance(member);

    const token = randomToken('fds');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.memberSession.create({ data: { memberId: member.id, tokenHash: sha256(token), expiresAt } });
    return { token, expiresAt, member: await this.me(member.id) };
  }

  /** Re-checks the balance. An RPC failure returns null and the last known balance is kept. */
  async refreshBalance(member: Pick<Member, 'id' | 'walletAddress'>) {
    const balance = await this.gate.getBalance(member.walletAddress);
    if (balance === null) return null;
    await this.prisma.member.update({
      where: { id: member.id },
      data: { tokenBalance: new Prisma.Decimal(balance), lastBalanceCheckAt: new Date() },
    });
    return balance;
  }

  /** Desk eligibility for tips. An unconfigured gate denies everyone; an RPC failure (null) does not revoke access. */
  canUseDesk(balance: number | null): boolean {
    return this.gate.configured && (balance === null || this.gate.isMember(balance));
  }

  async logout(rawToken: string) {
    await this.prisma.memberSession.deleteMany({ where: { tokenHash: sha256(rawToken) } });
    return { success: true };
  }

  async me(memberId: string) {
    const m = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    const balance = Number(m.tokenBalance);
    return {
      walletAddress: m.walletAddress,
      tokenBalance: balance,
      minBalance: this.gate.minBalance,
      isHolder: this.gate.isMember(balance),
      lastBalanceCheckAt: m.lastBalanceCheckAt,
    };
  }

  async createApiKey(memberId: string, label: string) {
    const active = await this.prisma.apiKey.count({ where: { memberId, revokedAt: null } });
    if (active >= MAX_API_KEYS) throw new BadRequestException(`Up to ${MAX_API_KEYS} active API keys`);
    const key = randomToken('fdk');
    const row = await this.prisma.apiKey.create({ data: { memberId, label, prefix: key.slice(0, 12), keyHash: sha256(key) } });
    return { id: row.id, label, prefix: row.prefix, key, createdAt: row.createdAt };
  }

  listApiKeys(memberId: string) {
    return this.prisma.apiKey.findMany({
      where: { memberId, revokedAt: null },
      select: { id: true, label: true, prefix: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(memberId: string, id: string) {
    const res = await this.prisma.apiKey.updateMany({ where: { id, memberId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!res.count) throw new NotFoundException('API key not found');
    return { success: true };
  }
}

/**
 * Verifies a one-time nonce. Used by holder login and by wallet proof for claimed accounts.
 * It is marked used atomically so a parallel replay fails.
 */
export async function consumeNonce(
  prisma: PrismaService,
  walletAddress: string,
  nonce: string,
  signature: string,
  purpose: string,
) {
  const row = await prisma.authNonce.findUnique({ where: { nonce } });
  if (!row || row.walletAddress !== walletAddress.trim() || row.purpose !== purpose) {
    throw new UnauthorizedException('Unknown signing request');
  }
  if (row.usedAt) throw new UnauthorizedException('This signing request was already used');
  if (row.expiresAt < new Date()) throw new UnauthorizedException('Signing request expired, try again');
  verifyWalletSignature(row.walletAddress, row.message, signature);
  const used = await prisma.authNonce.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) throw new UnauthorizedException('This signing request was already used');
  return row;
}
