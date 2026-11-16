import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Logger, Module, NotFoundException, Post, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { Member, TipKind } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentMember, MemberContext, MemberGuard, SessionGuard } from '../common/auth.guards';
import { CHAIN_REGISTRY, isValidAddressForChain } from '../config/explorer-registry';
import { consumeNonce } from '../members/members.service';
import { RULES } from '../rating/methodology';
import { formatActionId } from '../public/presenter';
import { MembersModule } from '../members/members.module';
import { MembersService } from '../members/members.service';

export class ClaimStartDto {
  @Matches(/^@?[A-Za-z0-9_]{1,15}$/) handle: string;
}

export class WalletNonceDto {
  @IsString() chain: string;
  @IsString() address: string;
}

export class WalletVerifyDto {
  @IsString() address: string;
  @IsString() nonce: string;
  @IsString() signature: string;
}

export class ReplyDto {
  @IsString() actionId: string; // RA-0001
  @IsString() @MinLength(10) @MaxLength(2000) body: string;
}

export class AppealDto {
  @IsString() actionId: string;
  @IsString() @MinLength(20) @MaxLength(4000) reason: string;
}

export class TipDto {
  @Matches(/^@?[A-Za-z0-9_]{1,15}$/) handle: string;
  @IsIn(Object.values(TipKind)) kind: TipKind;
  @IsUrl() evidenceUrl: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

const NONCE_TTL_MS = 10 * 60_000;
const actionNumber = (id: string) => {
  const n = Number(id.replace(/^RA-/i, ''));
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestException('actionId must look like RA-0001');
  return n;
};

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(private readonly prisma: PrismaService, private readonly members: MembersService) {}

  private async myInfluencer(member: Member) {
    const account = await this.prisma.socialAccount.findUnique({ where: { claimedById: member.id }, include: { influencer: true } });
    if (!account || account.influencer.status === 'removed') throw new ForbiddenException('Claim your profile first');
    return account.influencer;
  }

  // ─────────────────────────── Claim ───────────────────────────

  async start(member: Member, handleRaw: string) {
    const handle = handleRaw.replace(/^@/, '').toLowerCase();
    const account = await this.prisma.socialAccount.findUnique({ where: { platform_handle: { platform: 'x', handle } }, include: { influencer: true } });
    if (!account || account.influencer.status === 'removed') throw new NotFoundException(`@${handle} is not covered by FIDES`);
    if (account.claimedById) throw new ConflictException(`@${handle} is already claimed`);
    const mine = await this.prisma.socialAccount.findUnique({ where: { claimedById: member.id } });
    if (mine) throw new ConflictException(`This wallet already manages @${mine.handle}`);
    const code = `FIDES-${randomBytes(3).toString('hex').toUpperCase()}`;
    await this.prisma.socialAccount.update({ where: { id: account.id }, data: { claimCode: code, claimMemberId: member.id, claimCodeAt: new Date() } });
    return { handle, code, instructions: `Add ${code} to your X bio (or post it publicly from @${handle}), then press Verify.` };
  }

  /** Checks the code in the X bio when the X API is available; otherwise an analyst verifies manually. */
  async verify(member: Member) {
    const inf = await this.prisma.socialAccount.findFirst({ where: { claimMemberId: member.id } });
    if (!inf || !inf.claimCode) throw new BadRequestException('Start a claim first');
    const token = process.env.X_BEARER_TOKEN;
    if (!token) return { status: 'pending_manual', message: 'An analyst will check your X profile for the code within two business days.' };

    try {
      const base = process.env.X_API_URL || 'https://api.x.com';
      const res = await fetch(`${base}/2/users/by/username/${encodeURIComponent(inf.handle)}?user.fields=description`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : null;
      const bio: string = data?.data?.description ?? '';
      if (!bio.includes(inf.claimCode)) {
        return { status: 'not_found', message: `${inf.claimCode} was not found in the bio of @${inf.handle}. Add it and try again.` };
      }
    } catch (e) {
      this.logger.warn(`X lookup failed for @${inf.handle}: ${e.message}`);
      return { status: 'pending_manual', message: 'We could not reach X. An analyst will check manually.' };
    }
    await this.prisma.$transaction([
      this.prisma.socialAccount.update({
        where: { id: inf.id },
        data: { claimedById: member.id, claimedAt: new Date(), claimCode: null, claimMemberId: null },
      }),
      this.prisma.influencer.update({ where: { id: inf.influencerId }, data: { participating: true } }),
    ]);
    return { status: 'claimed', handle: inf.handle, message: 'Profile claimed. Your rating is now marked Participating.' };
  }

  /** Dashboard for a claimed account: actions in the notice period, the published rating, wallets. */
  async me(member: Member) {
    const inf = await this.myInfluencer(member);
    const [notices, published, wallets] = await Promise.all([
      this.prisma.ratingAction.findMany({ where: { influencerId: inf.id, status: 'notice' } }),
      this.prisma.ratingAction.findFirst({ where: { influencerId: inf.id, status: 'published' }, include: { reply: true, appeal: true } }),
      this.prisma.wallet.findMany({ where: { influencerId: inf.id } }),
    ]);
    return {
      handle: inf.handle,
      participating: inf.participating,
      notices: notices.map((a) => ({
        actionId: formatActionId(a.actionNumber), rating: a.rating, outlook: a.outlook, rationale: a.rationale, scorecardRating: a.scorecardRating,
        pillars: { accuracy: a.accuracy, disclosure: a.disclosure, walletAlignment: a.walletAlignment, conduct: a.conduct }, totalScore: a.totalScore,
        publishAfter: a.publishAfter, message: 'You can flag factual errors before this date. FIDES keeps editorial control of the opinion.',
      })),
      current: published
        ? {
            actionId: formatActionId(published.actionNumber), rating: published.rating, outlook: published.outlook, publishedAt: published.publishedAt,
            reply: published.reply?.body ?? null, appeal: published.appeal ? { status: published.appeal.status, decision: published.appeal.decision } : null,
            appealDeadline: published.publishedAt ? new Date(published.publishedAt.getTime() + RULES.appealDays * 86400_000) : null,
          }
        : null,
      wallets: wallets.map((w) => ({ chain: w.chainKey, address: w.address, method: w.method })),
    };
  }

  // ─────────────────────────── Wallets ─────────────────────────

  async walletNonce(member: Member, dto: WalletNonceDto) {
    const inf = await this.myInfluencer(member);
    const chain = dto.chain.toLowerCase();
    const cfg = CHAIN_REGISTRY[chain];
    if (!cfg || !['evm_hex', 'solana_base58'].includes(cfg.addressFormat)) throw new BadRequestException('Wallet proofs support EVM chains and Solana');
    if (!isValidAddressForChain(dto.address, cfg.addressFormat)) throw new BadRequestException(`Invalid ${cfg.displayName} address`);
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
    const message = [
      `This wallet belongs to @${inf.handle}. I agree that FIDES may show it publicly and use its history in my rating.`,
      `Wallet: ${dto.address.trim()}`,
      `Nonce: ${nonce}`,
      `Expires: ${expiresAt.toISOString()}`,
      'This request will not trigger a transaction or cost any fees.',
    ].join('\n');
    await this.prisma.authNonce.create({
      data: { walletAddress: dto.address.trim(), nonce, purpose: 'influencer_wallet', subjectId: inf.id, chainKey: chain, message, expiresAt },
    });
    return { message, nonce, expiresAt };
  }

  async walletVerify(member: Member, dto: WalletVerifyDto) {
    const inf = await this.myInfluencer(member);
    const row = await consumeNonce(this.prisma, dto.address, dto.nonce, dto.signature, 'influencer_wallet');
    if (row.subjectId !== inf.id) throw new ForbiddenException('This signing request belongs to another account');
    return this.prisma.wallet.upsert({
      where: { influencerId_chainKey_address: { influencerId: inf.id, chainKey: row.chainKey!, address: row.walletAddress } },
      create: { influencerId: inf.id, chainKey: row.chainKey!, address: row.walletAddress, method: 'signature' },
      update: { method: 'signature', verifiedAt: new Date() },
    });
  }

  // ──────────────────────── Reply & appeal ─────────────────────

  private async ownAction(member: Member, actionId: string) {
    const inf = await this.myInfluencer(member);
    const a = await this.prisma.ratingAction.findUnique({ where: { actionNumber: actionNumber(actionId) } });
    if (!a || a.influencerId !== inf.id) throw new NotFoundException('Rating action not found for your account');
    return a;
  }

  async reply(member: Member, dto: ReplyDto) {
    const a = await this.ownAction(member, dto.actionId);
    if (!['notice', 'published'].includes(a.status)) throw new BadRequestException('Replies are open during the notice period and after publication');
    return this.prisma.reply.upsert({ where: { actionId: a.id }, create: { actionId: a.id, body: dto.body }, update: { body: dto.body } });
  }

  async appeal(member: Member, dto: AppealDto) {
    const a = await this.ownAction(member, dto.actionId);
    if (a.status !== 'published') throw new BadRequestException('Only the published rating can be appealed');
    const deadline = a.publishedAt!.getTime() + RULES.appealDays * 86400_000;
    if (Date.now() > deadline) throw new BadRequestException(`Appeals close ${RULES.appealDays} days after publication`);
    if (await this.prisma.appeal.findUnique({ where: { actionId: a.id } })) throw new ConflictException('One appeal per rating action');
    return this.prisma.appeal.create({ data: { actionId: a.id, reason: dto.reason } });
  }

  // ─────────────────────────── Desk Tips ───────────────────────

  async tip(mc: MemberContext, dto: TipDto) {
    const balance = await this.members.refreshBalance(mc.member);
    if (!this.members.canUseDesk(balance)) {
      throw new ForbiddenException('Desk access requires the minimum token balance');
    }
    const inf = await this.prisma.influencer.findUnique({ where: { handle: dto.handle.replace(/^@/, '').toLowerCase() } });
    if (!inf || inf.status === 'removed') throw new NotFoundException('Account is not covered by FIDES');
    const dup = await this.prisma.tip.findFirst({ where: { influencerId: inf.id, evidenceUrl: dto.evidenceUrl } });
    if (dup) throw new ConflictException('This evidence was already submitted');
    await this.prisma.tip.create({ data: { memberId: mc.member.id, influencerId: inf.id, kind: dto.kind, evidenceUrl: dto.evidenceUrl, note: dto.note } });
    return { success: true, message: 'Thanks. An analyst will review the evidence. Tips never change a rating directly.' };
  }

  myTips(member: Member) {
    return this.prisma.tip.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
      select: { kind: true, evidenceUrl: true, status: true, createdAt: true, influencer: { select: { handle: true } } },
    });
  }
}

@Controller()
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post('claim/start')
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: 5, ttl: 3600_000 } })
  start(@CurrentMember() mc: MemberContext, @Body() dto: ClaimStartDto) {
    return this.claims.start(mc.member, dto.handle);
  }

  @Post('claim/verify')
  @UseGuards(SessionGuard)
  verify(@CurrentMember() mc: MemberContext) {
    return this.claims.verify(mc.member);
  }

  @Get('claim/me')
  @UseGuards(SessionGuard)
  me(@CurrentMember() mc: MemberContext) {
    return this.claims.me(mc.member);
  }

  @Post('claim/wallets/nonce')
  @UseGuards(SessionGuard)
  walletNonce(@CurrentMember() mc: MemberContext, @Body() dto: WalletNonceDto) {
    return this.claims.walletNonce(mc.member, dto);
  }

  @Post('claim/wallets/verify')
  @UseGuards(SessionGuard)
  walletVerify(@CurrentMember() mc: MemberContext, @Body() dto: WalletVerifyDto) {
    return this.claims.walletVerify(mc.member, dto);
  }

  @Post('claim/replies')
  @UseGuards(SessionGuard)
  reply(@CurrentMember() mc: MemberContext, @Body() dto: ReplyDto) {
    return this.claims.reply(mc.member, dto);
  }

  @Post('claim/appeals')
  @UseGuards(SessionGuard)
  appeal(@CurrentMember() mc: MemberContext, @Body() dto: AppealDto) {
    return this.claims.appeal(mc.member, dto);
  }

  @Post('tips')
  @UseGuards(MemberGuard)
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  tip(@CurrentMember() mc: MemberContext, @Body() dto: TipDto) {
    return this.claims.tip(mc, dto);
  }

  @Get('me/tips')
  @UseGuards(SessionGuard)
  myTips(@CurrentMember() mc: MemberContext) {
    return this.claims.myTips(mc.member);
  }
}

@Module({ imports: [MembersModule], controllers: [ClaimsController], providers: [ClaimsService] })
export class ClaimsModule {}
