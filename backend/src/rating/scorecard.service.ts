import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeScorecard, ScorecardResult } from './rating.engine';

const num = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? null : Number(v.toString()));

/** Loads one influencer from the database and runs the scorecard (a pure function in rating.engine). */
@Injectable()
export class ScorecardService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(influencerId: string, now = new Date()): Promise<ScorecardResult> {
    const inf = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      include: {
        calls: { include: { walletChecks: true } },
        promotions: { where: { status: 'confirmed' } },
        wallets: true,
      },
    });
    if (!inf) throw new NotFoundException('Influencer not found');
    return computeScorecard({
      now,
      calls: inf.calls.map((c) => ({
        id: c.id,
        postedAt: c.postedAt,
        direction: c.direction,
        priceAtCall: num(c.priceAtCall)!,
        price30d: num(c.price30d),
        btcAtCall: num(c.btcAtCall)!,
        btc30d: num(c.btc30d),
        deleted: !!c.deletedAt,
        rugConfirmedAt: c.projectRugConfirmedAt,
        retracted: !!c.retractedAt,
      })),
      promotions: inf.promotions.map((p) => ({ callId: p.callId, disclosed: p.disclosed })),
      walletChecks: inf.calls.flatMap((c) => c.walletChecks.map((w) => ({ callId: c.id, heldAtCall: w.heldAtCall, soldPct7d: w.soldPct7d }))),
      verifiedWalletCount: inf.wallets.length,
    });
  }
}
