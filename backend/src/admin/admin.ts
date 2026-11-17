import {
  BadRequestException, Body, ConflictException, Controller, Get, Inject, Injectable, Module, NotFoundException, Param, Patch, Post, Put, Query, UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Matches, Max,
  MaxLength, Min, ValidateNested,
} from 'class-validator';
import { CallDirection, Platform, Prisma, PromotionSource, TipStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { CurrentStaff, StaffGuard, StaffRoles } from '../common/auth.guards';
import { PRICE_PROVIDER, PriceProvider } from '../providers/price.provider';
import { ProvidersModule } from '../providers/providers.module';
import { CHAIN_REGISTRY, isValidAddressForChain } from '../config/explorer-registry';
import { METHODOLOGY_VERSION, RULES } from '../rating/methodology';
import { suggestOutlook } from '../rating/rating.engine';
import { ScorecardService } from '../rating/scorecard.service';
import { RatingModule } from '../rating/rating.module';
import { formatActionId } from '../public/presenter';

// ───────────────────────────── DTOs ─────────────────────────────

/** Platforms the MVP accepts. The data model supports the others; they are switched on here later. */
export const ENABLED_PLATFORMS: Platform[] = ['x'];

export class CreateInfluencerDto {
  @IsOptional() @IsEnum(Platform) platform?: Platform;
  @Matches(/^@?[A-Za-z0-9_]{1,15}$/) handle: string;
  @IsString() @MaxLength(60) displayName: string;
  @IsInt() @Min(0) followers: number;
  @IsOptional() @IsUrl() avatarUrl?: string;
}

export class AddAccountDto {
  @IsOptional() @IsEnum(Platform) platform?: Platform;
  @Matches(/^@?[A-Za-z0-9_]{1,15}$/) handle: string;
  @IsInt() @Min(0) followers: number;
}

export class UpdateAccountDto {
  @IsInt() @Min(0) followers: number;
}

export class UpdateInfluencerDto {
  @IsOptional() @IsString() @MaxLength(60) displayName?: string;
  @IsOptional() @IsUrl() avatarUrl?: string;
}

export class SnapshotDto {
  @IsUrl() sourceUrl: string;
  @IsOptional() @IsUrl() archiveUrl?: string;
  /** sha256 of the captured content, 64 hex characters. */
  @Matches(/^[a-f0-9]{64}$/i) contentHash: string;
  @IsOptional() @IsDateString() capturedAt?: string;
  /** Path of the stored file in private storage. Never exposed publicly. */
  @IsOptional() @IsString() @MaxLength(300) storagePath?: string;
}

export class RemoveDto {
  @IsString() @MaxLength(300) reason: string;
}

export class CallDto {
  /** Account that posted the call. Defaults to the influencer's oldest account. */
  @IsOptional() @IsString() socialAccountId?: string;
  @IsUrl() postUrl: string;
  @IsOptional() @IsUrl() archiveUrl?: string;
  @IsDateString() postedAt: string;
  @IsString() @MaxLength(20) tokenSymbol: string;
  @IsOptional() @IsString() chain?: string;
  @IsOptional() @IsString() tokenAddress?: string;
  @IsOptional() @IsEnum(CallDirection) direction?: CallDirection;
  @IsOptional() @IsBoolean() sponsoredDisclosed?: boolean;
  @IsNumber() @Min(0) priceAtCall: number;
  @IsNumber() @Min(0) btcAtCall: number;
  @IsOptional() @IsNumber() @Min(0) price7d?: number;
  @IsOptional() @IsNumber() @Min(0) price30d?: number;
  @IsOptional() @IsNumber() @Min(0) price90d?: number;
  @IsOptional() @IsNumber() @Min(0) btc7d?: number;
  @IsOptional() @IsNumber() @Min(0) btc30d?: number;
  @IsOptional() @IsNumber() @Min(0) btc90d?: number;
  /** Exchange, pool or document the analyst took the prices from. */
  @IsOptional() @IsString() @MaxLength(200) priceSourceRef?: string;
}

export class AddCallsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => CallDto) calls: CallDto[];
}

export class UpdateCallDto {
  @IsOptional() @IsNumber() @Min(0) price7d?: number;
  @IsOptional() @IsNumber() @Min(0) price30d?: number;
  @IsOptional() @IsNumber() @Min(0) price90d?: number;
  @IsOptional() @IsNumber() @Min(0) btc7d?: number;
  @IsOptional() @IsNumber() @Min(0) btc30d?: number;
  @IsOptional() @IsNumber() @Min(0) btc90d?: number;
  @IsOptional() @IsUrl() archiveUrl?: string;
  @IsOptional() @IsBoolean() deleted?: boolean;
  @IsOptional() @IsBoolean() rugConfirmed?: boolean;
  @IsOptional() @IsBoolean() retracted?: boolean;
}

export class AddWalletDto {
  @IsString() chain: string;
  @IsString() address: string;
  /** Public post by the account itself that names this wallet. Required: there are no "suspected" wallets. */
  @IsUrl() sourceUrl: string;
}

export class WalletCheckDto {
  @IsString() walletId: string;
  @IsBoolean() heldAtCall: boolean;
  @IsNumber() @Min(0) @Max(1) soldPct7d: number;
  @IsOptional() @IsArray() @IsString({ each: true }) txHashes?: string[];
}

export class SetWalletChecksDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => WalletCheckDto) checks: WalletCheckDto[];
}

export class AddPromotionDto {
  @IsOptional() @IsString() callId?: string;
  @IsEnum(PromotionSource) source: PromotionSource;
  @IsUrl() evidenceUrl: string;
  @IsBoolean() disclosed: boolean;
  @IsOptional() @IsNumber() @Min(0) amountUsd?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() fromTipId?: string;
}

export class ReviewDto {
  @IsIn(['confirmed', 'rejected']) status: 'confirmed' | 'rejected';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ReviewTipDto {
  @IsIn(['accepted', 'rejected', 'duplicate']) status: TipStatus;
}

export class SubmitActionDto {
  @IsOptional() @IsString() @MaxLength(1000) analystNote?: string;
}

// ─────────────────────────── Service ────────────────────────────

const OPEN_ACTION = ['draft', 'committee', 'notice'] as const;
const toDec = (n?: number) => (n === undefined ? undefined : new Prisma.Decimal(n));

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecard: ScorecardService,
    @Inject(PRICE_PROVIDER) private readonly prices: PriceProvider,
  ) {}

  private assertPlatformEnabled(platform: Platform) {
    if (!ENABLED_PLATFORMS.includes(platform)) throw new BadRequestException(`${platform} accounts are not supported yet`);
  }

  private assertFollowerFloor(followers: number) {
    if (followers < RULES.minFollowers) {
      throw new BadRequestException(`FIDES only covers public accounts with at least ${RULES.minFollowers.toLocaleString('en')} followers`);
    }
  }

  private async influencer(id: string) {
    const inf = await this.prisma.influencer.findUnique({ where: { id } });
    if (!inf) throw new NotFoundException('Influencer not found');
    if (inf.status === 'removed') throw new BadRequestException('This account was removed from coverage');
    return inf;
  }

  async createInfluencer(dto: CreateInfluencerDto) {
    const platform = dto.platform ?? 'x';
    this.assertPlatformEnabled(platform);
    this.assertFollowerFloor(dto.followers);
    const handle = dto.handle.replace(/^@/, '').toLowerCase();
    const taken = await this.prisma.socialAccount.findUnique({ where: { platform_handle: { platform, handle } } });
    if (taken || (await this.prisma.influencer.findUnique({ where: { handle } }))) throw new ConflictException(`@${handle} is already tracked`);
    return this.prisma.influencer.create({
      data: {
        handle, displayName: dto.displayName, avatarUrl: dto.avatarUrl,
        accounts: { create: { platform, handle, followers: dto.followers } },
      },
      include: { accounts: true },
    });
  }

  async addAccount(id: string, dto: AddAccountDto) {
    await this.influencer(id);
    const platform = dto.platform ?? 'x';
    this.assertPlatformEnabled(platform);
    this.assertFollowerFloor(dto.followers);
    const handle = dto.handle.replace(/^@/, '').toLowerCase();
    if (await this.prisma.socialAccount.findUnique({ where: { platform_handle: { platform, handle } } })) {
      throw new ConflictException(`@${handle} is already tracked`);
    }
    return this.prisma.socialAccount.create({ data: { influencerId: id, platform, handle, followers: dto.followers } });
  }

  async updateAccount(accountId: string, dto: UpdateAccountDto) {
    const acc = await this.prisma.socialAccount.findUnique({ where: { id: accountId }, include: { influencer: true } });
    if (!acc || acc.influencer.status === 'removed') throw new NotFoundException('Account not found');
    return this.prisma.socialAccount.update({ where: { id: accountId }, data: { followers: dto.followers } });
  }

  async updateInfluencer(id: string, dto: UpdateInfluencerDto) {
    await this.influencer(id);
    return this.prisma.influencer.update({ where: { id }, data: dto });
  }

  /** Takedown: the account leaves every public page. Open rating actions are cancelled. */
  async remove(id: string, reason: string) {
    const inf = await this.prisma.influencer.findUnique({ where: { id } });
    if (!inf) throw new NotFoundException('Influencer not found');
    await this.prisma.$transaction([
      this.prisma.ratingAction.updateMany({ where: { influencerId: id, status: { in: [...OPEN_ACTION] } }, data: { status: 'cancelled' } }),
      this.prisma.influencer.update({ where: { id }, data: { status: 'removed', removedAt: new Date(), removedReason: reason } }),
    ]);
    return { success: true, status: 'removed' };
  }

  /** Manual claim verification: the analyst confirmed the code on the account's public profile. */
  async confirmClaim(id: string) {
    await this.influencer(id);
    const acc = await this.prisma.socialAccount.findFirst({ where: { influencerId: id, claimMemberId: { not: null }, claimCode: { not: null } } });
    if (!acc) throw new BadRequestException('No pending claim for this account');
    await this.prisma.$transaction([
      this.prisma.socialAccount.update({
        where: { id: acc.id },
        data: { claimedById: acc.claimMemberId, claimedAt: new Date(), claimCode: null, claimMemberId: null },
      }),
      this.prisma.influencer.update({ where: { id }, data: { participating: true } }),
    ]);
    return { handle: acc.handle, participating: true };
  }

  async addCalls(id: string, dto: AddCallsDto, staff: User) {
    await this.influencer(id);
    const accounts = await this.prisma.socialAccount.findMany({ where: { influencerId: id }, orderBy: { createdAt: 'asc' } });
    if (!accounts.length) throw new BadRequestException('This influencer has no social account');
    const data: Prisma.CallCreateManyInput[] = [];
    for (const c of dto.calls) {
      if (c.chain && !CHAIN_REGISTRY[c.chain.toLowerCase()]) throw new BadRequestException(`Unsupported chain ${c.chain}`);
      const account = c.socialAccountId ? accounts.find((a) => a.id === c.socialAccountId) : accounts[0];
      if (!account) throw new BadRequestException('socialAccountId does not belong to this influencer');
      const q = await this.prices.quote(c);
      data.push({
        influencerId: id, socialAccountId: account.id, postUrl: c.postUrl, archiveUrl: c.archiveUrl, postedAt: new Date(c.postedAt),
        tokenSymbol: c.tokenSymbol.toUpperCase(), chainKey: c.chain?.toLowerCase(), tokenAddress: c.tokenAddress,
        direction: c.direction ?? 'long', sponsoredDisclosed: c.sponsoredDisclosed ?? false,
        priceAtCall: toDec(q.priceAtCall)!, btcAtCall: toDec(q.btcAtCall)!,
        price7d: toDec(q.price7d), price30d: toDec(q.price30d), price90d: toDec(q.price90d),
        btc7d: toDec(q.btc7d), btc30d: toDec(q.btc30d), btc90d: toDec(q.btc90d),
        priceSource: q.priceSource, priceSourceRef: q.priceSourceRef, enteredById: staff.id,
      });
    }
    const res = await this.prisma.call.createMany({ data, skipDuplicates: true });
    return { added: res.count, skippedDuplicates: data.length - res.count };
  }

  /** Records provenance for a call (source URL, content hash, capture time, who captured it). */
  async addCallSnapshot(callId: string, dto: SnapshotDto, staff: User) {
    if (!(await this.prisma.call.findUnique({ where: { id: callId }, select: { id: true } }))) throw new NotFoundException('Call not found');
    return this.prisma.evidenceSnapshot.create({ data: this.snapshotData(dto, staff, { callId }) });
  }

  async addPromotionSnapshot(promotionId: string, dto: SnapshotDto, staff: User) {
    if (!(await this.prisma.promotion.findUnique({ where: { id: promotionId }, select: { id: true } }))) throw new NotFoundException('Promotion not found');
    return this.prisma.evidenceSnapshot.create({ data: this.snapshotData(dto, staff, { promotionId }) });
  }

  private snapshotData(dto: SnapshotDto, staff: User, target: { callId: string } | { promotionId: string }) {
    return {
      ...target, sourceUrl: dto.sourceUrl, archiveUrl: dto.archiveUrl, contentHash: dto.contentHash.toLowerCase(),
      capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(), capturedById: staff.id, storagePath: dto.storagePath,
    };
  }

  listCalls(id: string) {
    return this.prisma.call.findMany({ where: { influencerId: id }, orderBy: { postedAt: 'desc' }, include: { walletChecks: true, promotions: true } });
  }

  async updateCall(callId: string, dto: UpdateCallDto) {
    const c = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!c) throw new NotFoundException('Call not found');
    const now = new Date();
    return this.prisma.call.update({
      where: { id: callId },
      data: {
        price7d: toDec(dto.price7d), price30d: toDec(dto.price30d), price90d: toDec(dto.price90d),
        btc7d: toDec(dto.btc7d), btc30d: toDec(dto.btc30d), btc90d: toDec(dto.btc90d), archiveUrl: dto.archiveUrl,
        deletedAt: dto.deleted === undefined ? undefined : dto.deleted ? c.deletedAt ?? now : null,
        projectRugConfirmedAt: dto.rugConfirmed === undefined ? undefined : dto.rugConfirmed ? c.projectRugConfirmedAt ?? now : null,
        retractedAt: dto.retracted === undefined ? undefined : dto.retracted ? c.retractedAt ?? now : null,
      },
    });
  }

  async addWallet(id: string, dto: AddWalletDto) {
    await this.influencer(id);
    const chain = dto.chain.toLowerCase();
    const cfg = CHAIN_REGISTRY[chain];
    if (!cfg) throw new BadRequestException(`Unsupported chain ${dto.chain}`);
    if (!isValidAddressForChain(dto.address, cfg.addressFormat)) throw new BadRequestException(`Invalid ${cfg.displayName} address`);
    return this.prisma.wallet.upsert({
      where: { influencerId_chainKey_address: { influencerId: id, chainKey: chain, address: dto.address.trim() } },
      create: { influencerId: id, chainKey: chain, address: dto.address.trim(), method: 'self_disclosed_post', sourceUrl: dto.sourceUrl },
      update: {},
    });
  }

  async setWalletChecks(callId: string, dto: SetWalletChecksDto) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    const wallets = await this.prisma.wallet.findMany({ where: { influencerId: call.influencerId, id: { in: dto.checks.map((c) => c.walletId) } } });
    if (wallets.length !== new Set(dto.checks.map((c) => c.walletId)).size) {
      throw new BadRequestException('Wallet checks can only use verified wallets of this account');
    }
    await this.prisma.$transaction(
      dto.checks.map((c) =>
        this.prisma.callWalletCheck.upsert({
          where: { callId_walletId: { callId, walletId: c.walletId } },
          create: { callId, walletId: c.walletId, heldAtCall: c.heldAtCall, soldPct7d: c.soldPct7d, txHashes: c.txHashes ?? [] },
          update: { heldAtCall: c.heldAtCall, soldPct7d: c.soldPct7d, txHashes: c.txHashes ?? [], checkedAt: new Date() },
        }),
      ),
    );
    return this.prisma.callWalletCheck.findMany({ where: { callId } });
  }

  async addPromotion(id: string, dto: AddPromotionDto) {
    await this.influencer(id);
    if (dto.callId) {
      const call = await this.prisma.call.findUnique({ where: { id: dto.callId } });
      if (!call || call.influencerId !== id) throw new BadRequestException('Call does not belong to this account');
    }
    const promo = await this.prisma.promotion.create({
      data: {
        influencerId: id, callId: dto.callId, source: dto.fromTipId ? 'tip' : dto.source, evidenceUrl: dto.evidenceUrl,
        disclosed: dto.disclosed, amountUsd: toDec(dto.amountUsd), note: dto.note,
      },
    });
    if (dto.fromTipId) await this.prisma.tip.update({ where: { id: dto.fromTipId }, data: { status: 'accepted', promotionId: promo.id } });
    return promo;
  }

  /** Only confirmed evidence feeds the scorecard and the public pages. The reviewing analyst is recorded. */
  async reviewPromotion(promoId: string, dto: ReviewDto, staff: User) {
    const p = await this.prisma.promotion.findUnique({ where: { id: promoId } });
    if (!p) throw new NotFoundException('Promotion not found');
    return this.prisma.promotion.update({
      where: { id: promoId },
      data: { status: dto.status, note: dto.note ?? p.note, reviewedById: staff.id, reviewedAt: new Date() },
    });
  }

  async listTips(status?: TipStatus) {
    const tips = await this.prisma.tip.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { influencer: { select: { id: true, handle: true } } },
    });
    // Analysts never see who sent a tip
    return tips.map(({ memberId, ...t }) => t);
  }

  reviewTip(id: string, dto: ReviewTipDto) {
    return this.prisma.tip.update({ where: { id }, data: { status: dto.status } });
  }

  // ─────────────────────── Rating actions ───────────────────────

  /** The analyst creates a draft: the scorecard is calculated from the current data. */
  async createAction(id: string, staff: User) {
    const inf = await this.influencer(id);
    const open = await this.prisma.ratingAction.findFirst({ where: { influencerId: id, status: { in: [...OPEN_ACTION] } } });
    if (open) throw new ConflictException(`${formatActionId(open.actionNumber)} is already open for @${inf.handle}`);

    const sc = await this.scorecard.compute(id);
    const previous = await this.prisma.ratingAction.findFirst({ where: { influencerId: id, status: 'published' } });
    const suggested = suggestOutlook(
      { totalScore: sc.totalScore, pillars: sc.pillars },
      previous && previous.accuracy !== null
        ? {
            totalScore: previous.totalScore,
            pillars: { accuracy: previous.accuracy!, disclosure: previous.disclosure!, walletAlignment: previous.walletAlignment!, conduct: previous.conduct! },
          }
        : null,
    );

    const action = await this.prisma.$transaction(
      async (tx) => {
        const last = await tx.ratingAction.aggregate({ _max: { actionNumber: true } });
        return tx.ratingAction.create({
          data: {
            actionNumber: (last._max.actionNumber ?? 0) + 1,
            influencerId: id,
            methodologyVersion: METHODOLOGY_VERSION,
            accuracy: sc.pillars?.accuracy, disclosure: sc.pillars?.disclosure,
            walletAlignment: sc.pillars?.walletAlignment, conduct: sc.pillars?.conduct,
            totalScore: sc.totalScore, indicatedRating: sc.indicatedRating, scorecardRating: sc.scorecardRating,
            appliedCaps: sc.appliedCaps, isDefault: sc.isDefault, notRated: sc.notRated, measurableCalls: sc.measurableCalls,
            inputs: sc.inputs as unknown as Prisma.InputJsonValue, suggestedOutlook: suggested,
            analystId: staff.id, previousId: previous?.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.prisma.influencer.update({ where: { id }, data: { status: inf.status === 'tracked' ? 'under_review' : inf.status } });
    return { ...action, actionId: formatActionId(action.actionNumber) };
  }

  async getAction(actionId: string) {
    const a = await this.prisma.ratingAction.findUnique({
      where: { id: actionId },
      include: { influencer: { select: { handle: true, displayName: true } }, votes: { include: { staff: { select: { name: true } } } }, reply: true, appeal: true },
    });
    if (!a) throw new NotFoundException('Rating action not found');
    return { ...a, actionId: formatActionId(a.actionNumber) };
  }

  /** Recalculates the scorecard while the action is still a draft (after data fixes). */
  async recompute(actionId: string) {
    const a = await this.prisma.ratingAction.findUnique({ where: { id: actionId } });
    if (!a) throw new NotFoundException('Rating action not found');
    if (a.status !== 'draft') throw new BadRequestException('Only drafts can be recomputed');
    const sc = await this.scorecard.compute(a.influencerId);
    return this.prisma.ratingAction.update({
      where: { id: actionId },
      data: {
        accuracy: sc.pillars?.accuracy ?? null, disclosure: sc.pillars?.disclosure ?? null,
        walletAlignment: sc.pillars?.walletAlignment ?? null, conduct: sc.pillars?.conduct ?? null,
        totalScore: sc.totalScore, indicatedRating: sc.indicatedRating, scorecardRating: sc.scorecardRating, appliedCaps: sc.appliedCaps,
        isDefault: sc.isDefault, notRated: sc.notRated, measurableCalls: sc.measurableCalls, inputs: sc.inputs as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async submit(actionId: string) {
    const a = await this.prisma.ratingAction.findUnique({ where: { id: actionId } });
    if (!a) throw new NotFoundException('Rating action not found');
    if (a.status !== 'draft') throw new BadRequestException(`Action is ${a.status}`);
    const pending = await this.prisma.promotion.count({ where: { influencerId: a.influencerId, status: 'pending' } });
    if (pending) throw new BadRequestException(`${pending} promotion evidence item(s) are still pending review`);
    return this.prisma.ratingAction.update({ where: { id: actionId }, data: { status: 'committee' } });
  }

  listInfluencers(status?: string) {
    return this.prisma.influencer.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: 'desc' },
      include: { accounts: { select: { id: true, platform: true, handle: true, followers: true } }, _count: { select: { calls: true, wallets: true, promotions: true } } },
    });
  }
}

// ────────────────────────── Controller ──────────────────────────

@Controller('admin')
@UseGuards(StaffGuard)
@UseInterceptors(AuditInterceptor)
@StaffRoles('analyst')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('influencers')
  list(@Query('status') status?: string) {
    return this.admin.listInfluencers(status);
  }

  @Post('influencers')
  create(@Body() dto: CreateInfluencerDto) {
    return this.admin.createInfluencer(dto);
  }

  @Post('influencers/:id/accounts')
  addAccount(@Param('id') id: string, @Body() dto: AddAccountDto) {
    return this.admin.addAccount(id, dto);
  }

  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.admin.updateAccount(id, dto);
  }

  @Patch('influencers/:id')
  update(@Param('id') id: string, @Body() dto: UpdateInfluencerDto) {
    return this.admin.updateInfluencer(id, dto);
  }

  @Post('influencers/:id/remove')
  @StaffRoles('admin')
  remove(@Param('id') id: string, @Body() dto: RemoveDto) {
    return this.admin.remove(id, dto.reason);
  }

  @Post('influencers/:id/confirm-claim')
  confirmClaim(@Param('id') id: string) {
    return this.admin.confirmClaim(id);
  }

  @Get('influencers/:id/calls')
  calls(@Param('id') id: string) {
    return this.admin.listCalls(id);
  }

  @Post('influencers/:id/calls')
  addCalls(@Param('id') id: string, @Body() dto: AddCallsDto, @CurrentStaff() staff: User) {
    return this.admin.addCalls(id, dto, staff);
  }

  @Post('calls/:id/snapshots')
  addCallSnapshot(@Param('id') id: string, @Body() dto: SnapshotDto, @CurrentStaff() staff: User) {
    return this.admin.addCallSnapshot(id, dto, staff);
  }

  @Post('promotions/:id/snapshots')
  addPromotionSnapshot(@Param('id') id: string, @Body() dto: SnapshotDto, @CurrentStaff() staff: User) {
    return this.admin.addPromotionSnapshot(id, dto, staff);
  }

  @Patch('calls/:id')
  updateCall(@Param('id') id: string, @Body() dto: UpdateCallDto) {
    return this.admin.updateCall(id, dto);
  }

  @Put('calls/:id/wallet-checks')
  walletChecks(@Param('id') id: string, @Body() dto: SetWalletChecksDto) {
    return this.admin.setWalletChecks(id, dto);
  }

  @Post('influencers/:id/wallets')
  addWallet(@Param('id') id: string, @Body() dto: AddWalletDto) {
    return this.admin.addWallet(id, dto);
  }

  @Post('influencers/:id/promotions')
  addPromotion(@Param('id') id: string, @Body() dto: AddPromotionDto) {
    return this.admin.addPromotion(id, dto);
  }

  @Post('promotions/:id/review')
  reviewPromotion(@Param('id') id: string, @Body() dto: ReviewDto, @CurrentStaff() staff: User) {
    return this.admin.reviewPromotion(id, dto, staff);
  }

  @Get('tips')
  tips(@Query('status') status?: TipStatus) {
    return this.admin.listTips(status);
  }

  @Post('tips/:id/review')
  reviewTip(@Param('id') id: string, @Body() dto: ReviewTipDto) {
    return this.admin.reviewTip(id, dto);
  }

  @Post('influencers/:id/actions')
  createAction(@Param('id') id: string, @CurrentStaff() staff: User) {
    return this.admin.createAction(id, staff);
  }

  @Get('actions/:id')
  getAction(@Param('id') id: string) {
    return this.admin.getAction(id);
  }

  @Post('actions/:id/recompute')
  recompute(@Param('id') id: string) {
    return this.admin.recompute(id);
  }

  @Post('actions/:id/submit')
  submit(@Param('id') id: string) {
    return this.admin.submit(id);
  }
}

/** Tells a signed-in staff wallet which role the allowlist gave it. Any staff role may call it. */
@Controller('staff')
@UseGuards(StaffGuard)
export class StaffController {
  @Get('me')
  me(@CurrentStaff() staff: User) {
    return { role: staff.role, walletAddress: staff.walletAddress };
  }
}

@Module({ imports: [RatingModule, ProvidersModule], controllers: [AdminController, StaffController], providers: [AdminService] })
export class AdminModule {}
