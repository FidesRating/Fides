import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, Injectable, Module, NotFoundException, Post, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
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
import { REAPPLY_DAYS } from '../applications/applications';
import { HttpXOAuth, makePkce, X_OAUTH, XOAuthAdapter, XProfile } from './x-oauth';

export class XCallbackDto {
  @IsString() @MaxLength(512) code: string;
  @IsString() @MaxLength(64) state: string;
}

export class StartClaimDto {
  /** Chain of the login wallet. It is saved as the account's rating wallet when the claim succeeds. */
  @IsString() @MaxLength(32) chain: string;
  /** The owner agrees that the login wallet is shown publicly and its history is used in the rating. */
  @IsBoolean() consent: boolean;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    @Inject(X_OAUTH) private readonly x: XOAuthAdapter,
  ) {}

  private async myInfluencer(member: Member) {
    const account = await this.prisma.socialAccount.findUnique({ where: { claimedById: member.id }, include: { influencer: true } });
    if (!account || account.influencer.status === 'removed') throw new ForbiddenException('Claim your profile first');
    return account.influencer;
  }

  // ─────────────────────────── Claim ───────────────────────────

  /** Step 1: the member is sent to X to log in. The PKCE verifier is kept here, keyed by a one-time state. */
  async start(member: Member, dto: StartClaimDto) {
    if (dto.consent !== true) throw new BadRequestException('Agree that your login wallet is shown publicly and used in your rating');
    const chain = dto.chain.toLowerCase();
    const cfg = CHAIN_REGISTRY[chain];
    if (!cfg || !['evm_hex', 'solana_base58'].includes(cfg.addressFormat)) throw new BadRequestException('Choose an EVM chain or Solana for your login wallet');
    if (!isValidAddressForChain(member.walletAddress, cfg.addressFormat)) throw new BadRequestException(`Your login wallet is not a valid ${cfg.displayName} address`);
    const mine = await this.prisma.socialAccount.findUnique({ where: { claimedById: member.id } });
    if (mine) throw new ConflictException(`This wallet already manages @${mine.handle}`);
    const { verifier, challenge } = makePkce();
    const state = randomBytes(16).toString('hex');
    const url = this.x.authorizeUrl(state, challenge); // fails closed when X credentials are not configured
    await this.prisma.authNonce.create({
      data: { walletAddress: member.walletAddress, nonce: state, purpose: 'x_claim', subjectId: member.id, chainKey: chain, message: verifier, expiresAt: new Date(Date.now() + NONCE_TTL_MS) },
    });
    return { authorizeUrl: url };
  }

  /** Step 2: X sends the member back with a code. The verified X username decides which account is claimed. */
  async complete(member: Member, dto: XCallbackDto) {
    const row = await this.prisma.authNonce.findUnique({ where: { nonce: dto.state } });
    if (!row || row.purpose !== 'x_claim' || row.subjectId !== member.id) throw new UnauthorizedException('Unknown login request');
    if (row.usedAt || row.expiresAt < new Date()) throw new UnauthorizedException('This login request expired or was already used');
    const used = await this.prisma.authNonce.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new UnauthorizedException('This login request was already used');

    const profile = await this.x.verifiedProfile(dto.code, row.message);
    const handle = profile.username;
    const mine = await this.prisma.socialAccount.findUnique({ where: { claimedById: member.id } });
    if (mine) throw new ConflictException(`This wallet already manages @${mine.handle}`);
    const account = await this.prisma.socialAccount.findUnique({ where: { platform_handle: { platform: 'x', handle } }, include: { influencer: true } });
    if (account?.influencer.status === 'removed') throw new NotFoundException(`@${handle} is not covered by FIDES`);

    const chainKey = row.chainKey;
    if (!chainKey) throw new UnauthorizedException('Unknown login request');
    if (!account) return this.startApplication(member, profile, chainKey);
    if (account.claimedById) throw new ConflictException(`@${handle} is already claimed`);

    await this.prisma.$transaction([
      this.prisma.socialAccount.update({ where: { id: account.id }, data: { claimedById: member.id, claimedAt: new Date() } }),
      this.prisma.influencer.update({ where: { id: account.influencerId }, data: { participating: true } }),
      // The owner agreed on the claim screen. The login wallet was proved by the sign-in signature.
      this.prisma.wallet.upsert({
        where: { influencerId_chainKey_address: { influencerId: account.influencerId, chainKey, address: member.walletAddress } },
        create: { influencerId: account.influencerId, chainKey, address: member.walletAddress, method: 'signature' },
        update: { method: 'signature', verifiedAt: new Date() },
      }),
    ]);
    return { status: 'claimed', handle, message: 'Profile claimed. Your rating is now marked Participating.' };
  }

  /**
   * The account is not covered yet. The verified X login proves the member owns it, so the member can apply for coverage.
   * The identity and follower count come from X, never from the form. A rejected application can be repeated after a cooldown.
   */
  private async startApplication(member: Member, profile: XProfile, walletChain: string) {
    const { username: handle } = profile;
    if (profile.followers < RULES.minFollowers) {
      throw new BadRequestException(
        `@${handle} has ${profile.followers.toLocaleString('en')} followers. FIDES only covers public accounts with at least ${RULES.minFollowers.toLocaleString('en')} followers, so this account cannot apply yet. Disconnect your wallet and log in with another X account, or come back when the account reaches the minimum.`,
      );
    }
    const open = await this.prisma.application.findFirst({ where: { handle, status: { in: ['draft', 'submitted'] }, NOT: { memberId: member.id } } });
    if (open) throw new ConflictException(`An application for @${handle} is already open`);

    const latest = await this.prisma.application.findFirst({ where: { memberId: member.id }, orderBy: { createdAt: 'desc' } });
    if (latest?.status === 'submitted') throw new ConflictException('Your application is already under review');
    if (latest?.status === 'rejected' && latest.decidedAt && Date.now() < latest.decidedAt.getTime() + REAPPLY_DAYS * 86400_000) {
      throw new ConflictException(`A rejected application can be repeated ${REAPPLY_DAYS} days after the decision`);
    }
    const data = { handle, displayName: profile.name.slice(0, 60), avatarUrl: profile.avatarUrl, followers: profile.followers, walletChain };
    if (latest?.status === 'draft') await this.prisma.application.update({ where: { id: latest.id }, data });
    else await this.prisma.application.create({ data: { memberId: member.id, ...data } });
    return { status: 'application', handle, message: `@${handle} is not covered yet. Fill in the application below.` };
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

  /** The owner saves a wallet once. A wrong one is removed by an admin, then the owner saves again. */
  private async assertNoOwnerWallet(influencerId: string) {
    const saved = await this.prisma.wallet.count({ where: { influencerId, method: 'signature' } });
    if (saved > 0) throw new ConflictException('A wallet is already saved. Ask FIDES staff if it must be changed.');
  }

  async walletNonce(member: Member, dto: WalletNonceDto) {
    const inf = await this.myInfluencer(member);
    await this.assertNoOwnerWallet(inf.id);
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
    await this.assertNoOwnerWallet(inf.id);
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

  @Post('claim/x/start')
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  start(@CurrentMember() mc: MemberContext, @Body() dto: StartClaimDto) {
    return this.claims.start(mc.member, dto);
  }

  @Post('claim/x/complete')
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  complete(@CurrentMember() mc: MemberContext, @Body() dto: XCallbackDto) {
    return this.claims.complete(mc.member, dto);
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

@Module({
  imports: [MembersModule],
  controllers: [ClaimsController],
  providers: [ClaimsService, { provide: X_OAUTH, useClass: HttpXOAuth }],
})
export class ClaimsModule {}
