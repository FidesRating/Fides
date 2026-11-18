import {
  BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Post, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { ApplicationStatus, Member, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { CurrentMember, CurrentStaff, MemberContext, SessionGuard, StaffGuard, StaffRoles } from '../common/auth.guards';
import { isXStatusUrl } from '../committee/notice';

/** A rejected application can be repeated only after this many days. */
export const REAPPLY_DAYS = 30;
/** Public posts the applicant must link to show regular token calls. */
export const MIN_EVIDENCE = 3;
export const MAX_EVIDENCE = 5;

export class SubmitApplicationDto {
  @IsArray() @ArrayMinSize(MIN_EVIDENCE) @ArrayMaxSize(MAX_EVIDENCE) @IsUrl({}, { each: true }) evidenceUrls: string[];
  /** The applicant understands that a rating is an opinion, with notice, reply and appeal, and that applying does not affect it. */
  @IsBoolean() consent: boolean;
}

export class ReviewApplicationDto {
  @IsIn(['accepted', 'rejected']) status: 'accepted' | 'rejected';
  /** Shown to the applicant on the claim page. Required when rejecting. */
  @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) note?: string;
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The applicant's latest application, shown on the claim page. Decision notes are meant for the applicant. */
  mine(member: Member) {
    return this.prisma.application.findFirst({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, handle: true, displayName: true, avatarUrl: true, followers: true, status: true, evidenceUrls: true, decisionNote: true, decidedAt: true, createdAt: true },
    });
  }

  async submit(member: Member, dto: SubmitApplicationDto) {
    if (dto.consent !== true) throw new BadRequestException('You must accept the rating terms to apply');
    if (!dto.evidenceUrls.every(isXStatusUrl)) throw new BadRequestException('Every evidence link must be a public X post, like https://x.com/name/status/123');
    if (new Set(dto.evidenceUrls).size !== dto.evidenceUrls.length) throw new BadRequestException('Each evidence link must be different');

    const draft = await this.prisma.application.findFirst({ where: { memberId: member.id, status: 'draft' }, orderBy: { createdAt: 'desc' } });
    if (!draft) throw new BadRequestException('Log in with X first to start an application');
    // The account may have been added by staff while the draft was open. Then it is a claim, not an application.
    const covered = await this.prisma.socialAccount.findUnique({ where: { platform_handle: { platform: 'x', handle: draft.handle } } });
    if (covered) throw new ConflictException(`@${draft.handle} is already covered. Log in with X again to claim it.`);

    await this.prisma.application.update({ where: { id: draft.id }, data: { status: 'submitted', evidenceUrls: dto.evidenceUrls, consentAt: new Date() } });
    return { status: 'submitted', message: 'Application sent. Staff will review it, and the decision will appear on this page.' };
  }

  /** Signs out of X: only an unsent draft can be dropped. A submitted application stays with staff. */
  async discardDraft(member: Member) {
    const res = await this.prisma.application.deleteMany({ where: { memberId: member.id, status: 'draft' } });
    return { discarded: res.count };
  }

  list(status?: ApplicationStatus) {
    return this.prisma.application.findMany({
      where: { status: status ?? 'submitted' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, handle: true, displayName: true, avatarUrl: true, followers: true, status: true, evidenceUrls: true, consentAt: true, decisionNote: true, decidedAt: true, createdAt: true },
    });
  }

  /** Accepting creates the covered account already claimed by the applicant. Rejecting needs a note the applicant can read. */
  async review(id: string, dto: ReviewApplicationDto, staff: User) {
    const a = await this.prisma.application.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Application not found');
    if (a.status !== 'submitted') throw new BadRequestException(`Application is ${a.status}`);
    const now = new Date();

    if (dto.status === 'rejected') {
      if (!dto.note) throw new BadRequestException('A rejection needs a note for the applicant');
      return this.prisma.application.update({ where: { id }, data: { status: 'rejected', decisionNote: dto.note, decidedAt: now, decidedById: staff.id }, select: { id: true, status: true } });
    }

    const member = await this.prisma.member.findUnique({ where: { id: a.memberId }, select: { walletAddress: true } });
    if (!member) throw new NotFoundException('The applicant no longer exists');
    const taken = await this.prisma.influencer.findUnique({ where: { handle: a.handle } });
    const takenAccount = await this.prisma.socialAccount.findUnique({ where: { platform_handle: { platform: 'x', handle: a.handle } } });
    if (taken || takenAccount) throw new ConflictException(`@${a.handle} is already tracked`);
    const manages = await this.prisma.socialAccount.findUnique({ where: { claimedById: a.memberId } });
    if (manages) throw new ConflictException(`This applicant already manages @${manages.handle}`);

    await this.prisma.$transaction([
      this.prisma.influencer.create({
        data: {
          handle: a.handle, displayName: a.displayName, avatarUrl: a.avatarUrl, participating: true,
          accounts: { create: { platform: 'x', handle: a.handle, followers: a.followers, claimedById: a.memberId, claimedAt: now } },
          // The applicant agreed on the claim screen that the login wallet is shown and used in the rating.
          ...(a.walletChain ? { wallets: { create: { chainKey: a.walletChain, address: member.walletAddress, method: 'signature' as const } } } : {}),
        },
      }),
      this.prisma.application.update({ where: { id }, data: { status: 'accepted', decisionNote: dto.note ?? null, decidedAt: now, decidedById: staff.id } }),
    ]);
    return { id, status: 'accepted', handle: a.handle };
  }
}

@Controller('claim/application')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  @UseGuards(SessionGuard)
  mine(@CurrentMember() mc: MemberContext) {
    return this.applications.mine(mc.member);
  }

  @Post('discard')
  @UseGuards(SessionGuard)
  discard(@CurrentMember() mc: MemberContext) {
    return this.applications.discardDraft(mc.member);
  }

  @Post('submit')
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  submit(@CurrentMember() mc: MemberContext, @Body() dto: SubmitApplicationDto) {
    return this.applications.submit(mc.member, dto);
  }
}

@Controller('admin/applications')
@UseGuards(StaffGuard)
@UseInterceptors(AuditInterceptor)
@StaffRoles('analyst')
export class ApplicationsStaffController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@Query('status') status?: ApplicationStatus) {
    return this.applications.list(status);
  }

  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewApplicationDto, @CurrentStaff() staff: User) {
    return this.applications.review(id, dto, staff);
  }
}

@Module({ controllers: [ApplicationsController, ApplicationsStaffController], providers: [ApplicationsService] })
export class ApplicationsModule {}
