import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Put, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Outlook, User, Watch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { CurrentStaff, StaffGuard, StaffRoles } from '../common/auth.guards';
import { ALL_RATINGS, RULES } from '../rating/methodology';
import { actionType, allowedVotes, committeeOutlook, committeeRating } from '../rating/rating.engine';
import { formatActionId } from '../public/presenter';

export class VoteDto {
  @IsOptional() @IsBoolean() recuse?: boolean;
  @ValidateIf((o) => !o.recuse) @IsIn(ALL_RATINGS) rating?: string;
  @ValidateIf((o) => !o.recuse) @IsEnum(Outlook) outlook?: Outlook;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class FinalizeDto {
  @IsOptional() @IsString() @MaxLength(2000) rationale?: string;
}

export class WatchDto {
  @IsOptional() @IsEnum(Watch) watch?: Watch | null;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ConflictDto {
  @IsString() influencerId: string;
  @IsString() @MaxLength(300) reason: string;
}

export class DecideAppealDto {
  @IsIn(['upheld', 'reopened', 'rejected']) decision: 'upheld' | 'reopened' | 'rejected';
  @IsString() @MaxLength(2000) note: string;
}

const noticeMs = () => Number(process.env.NOTICE_HOURS ?? RULES.noticeHours) * 3600_000;

@Injectable()
export class CommitteeService {
  constructor(private readonly prisma: PrismaService) {}

  private async action(id: string) {
    const a = await this.prisma.ratingAction.findUnique({ where: { id }, include: { influencer: true, previous: true } });
    if (!a) throw new NotFoundException('Rating action not found');
    return a;
  }

  async queue(staff: User) {
    const rows = await this.prisma.ratingAction.findMany({
      where: { status: { in: ['committee', 'notice'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        influencer: { select: { id: true, handle: true, displayName: true, accounts: { select: { followers: true } } } },
        votes: { select: { staffId: true, recused: true } },
      },
    });
    const conflicts = new Set(
      (await this.prisma.conflictDeclaration.findMany({ where: { staffId: staff.id } })).map((c) => c.influencerId),
    );
    return rows.map((a) => ({
      id: a.id, actionId: formatActionId(a.actionNumber), status: a.status, influencer: a.influencer,
      scorecard: {
        accuracy: a.accuracy, disclosure: a.disclosure, walletAlignment: a.walletAlignment, conduct: a.conduct,
        totalScore: a.totalScore, indicatedRating: a.indicatedRating, scorecardRating: a.scorecardRating,
        appliedCaps: a.appliedCaps, isDefault: a.isDefault, notRated: a.notRated, inputs: a.inputs,
      },
      suggestedOutlook: a.suggestedOutlook,
      allowedVotes: a.scorecardRating ? allowedVotes(a.scorecardRating, a.appliedCaps) : [],
      votesCast: a.votes.filter((v) => !v.recused).length,
      myVote: a.votes.find((v) => v.staffId === staff.id) ?? null,
      conflicted: conflicts.has(a.influencer.id),
      publishAfter: a.publishAfter,
    }));
  }

  /** Conflict declaration: the member is automatically recused from every open action of that account. */
  async declareConflict(staff: User, dto: ConflictDto) {
    await this.prisma.conflictDeclaration.upsert({
      where: { staffId_influencerId: { staffId: staff.id, influencerId: dto.influencerId } },
      create: { staffId: staff.id, influencerId: dto.influencerId, reason: dto.reason },
      update: { reason: dto.reason },
    });
    const open = await this.prisma.ratingAction.findMany({ where: { influencerId: dto.influencerId, status: 'committee' } });
    for (const a of open) {
      await this.prisma.committeeVote.upsert({
        where: { actionId_staffId: { actionId: a.id, staffId: staff.id } },
        create: { actionId: a.id, staffId: staff.id, recused: true, note: 'Conflict declared' },
        update: { recused: true, rating: null, outlook: null, note: 'Conflict declared' },
      });
    }
    return { success: true, recusedActions: open.length };
  }

  async vote(staff: User, id: string, dto: VoteDto) {
    const a = await this.action(id);
    if (a.status !== 'committee') throw new BadRequestException(`Votes are closed (action is ${a.status})`);
    const conflict = await this.prisma.conflictDeclaration.findUnique({
      where: { staffId_influencerId: { staffId: staff.id, influencerId: a.influencerId } },
    });
    if (conflict && !dto.recuse) throw new ForbiddenException('You declared a conflict for this account and are recused');
    if (!dto.recuse) {
      const allowed = allowedVotes(a.scorecardRating!, a.appliedCaps);
      if (!allowed.includes(dto.rating!)) {
        throw new BadRequestException({ message: `Votes must be within one notch of the scorecard and respect caps`, allowed });
      }
    }
    return this.prisma.committeeVote.upsert({
      where: { actionId_staffId: { actionId: id, staffId: staff.id } },
      create: { actionId: id, staffId: staff.id, recused: !!dto.recuse, rating: dto.recuse ? null : dto.rating, outlook: dto.recuse ? null : dto.outlook, note: dto.note },
      update: { recused: !!dto.recuse, rating: dto.recuse ? null : dto.rating, outlook: dto.recuse ? null : dto.outlook, note: dto.note },
    });
  }

  /** Median vote → rating; mode → outlook; then the notice period for the rated account. */
  async finalize(id: string, dto: FinalizeDto) {
    const a = await this.action(id);
    if (a.status !== 'committee') throw new BadRequestException(`Action is ${a.status}`);
    const votes = await this.prisma.committeeVote.findMany({ where: { actionId: id, recused: false } });
    if (votes.length < RULES.minCommitteeVotes) {
      throw new BadRequestException(`At least ${RULES.minCommitteeVotes} non-recused votes are required (have ${votes.length})`);
    }
    const rating = committeeRating(votes.map((v) => v.rating!));
    const outlook = rating === 'NR' || rating === 'D' ? null : committeeOutlook(votes.map((v) => v.outlook!));
    if (rating !== a.scorecardRating && !dto.rationale) {
      throw new BadRequestException('A published rationale is required when the rating differs from the scorecard');
    }
    const now = new Date();
    return this.prisma.ratingAction.update({
      where: { id },
      data: {
        rating, outlook, rationale: dto.rationale ?? null,
        type: actionType(a.previous?.rating ?? null, rating),
        status: 'notice', finalizedAt: now, noticeSentAt: now,
        noticeChannel: a.influencer.participating ? 'profile' : 'x_mention',
        publishAfter: new Date(now.getTime() + noticeMs()),
      },
    });
  }

  async publish(id: string) {
    const a = await this.action(id);
    if (a.status !== 'notice') throw new BadRequestException(`Only actions in the notice period can be published (action is ${a.status})`);
    if (!a.publishAfter || a.publishAfter > new Date()) {
      throw new BadRequestException(`The rated account has until ${a.publishAfter?.toISOString()} to flag factual errors`);
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ratingAction.updateMany({ where: { influencerId: a.influencerId, status: 'published' }, data: { status: 'superseded' } }),
      this.prisma.ratingAction.update({ where: { id }, data: { status: 'published', publishedAt: now } }),
      this.prisma.influencer.update({
        where: { id: a.influencerId },
        data: { status: a.rating === 'NR' ? 'not_rated' : 'rated', reviewDue: false, reviewDueReason: null },
      }),
    ]);
    return { success: true, actionId: formatActionId(a.actionNumber), rating: a.rating, outlook: a.outlook, type: a.type };
  }

  /** Rating Watch is set or cleared on a published rating. */
  async setWatch(id: string, dto: WatchDto) {
    const a = await this.action(id);
    if (a.status !== 'published') throw new BadRequestException('Watch applies to the published rating');
    if (dto.watch && !dto.reason) throw new BadRequestException('A Rating Watch needs a public reason');
    return this.prisma.ratingAction.update({
      where: { id },
      data: { watch: dto.watch ?? null, watchReason: dto.watch ? dto.reason : null, watchSetAt: dto.watch ? new Date() : null },
    });
  }

  appeals(status?: string) {
    return this.prisma.appeal.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: 'asc' },
      include: { action: { select: { actionNumber: true, rating: true, influencer: { select: { handle: true } } } } },
    });
  }

  async decideAppeal(id: string, dto: DecideAppealDto) {
    const ap = await this.prisma.appeal.findUnique({ where: { id }, include: { action: true } });
    if (!ap) throw new NotFoundException('Appeal not found');
    if (ap.status !== 'open') throw new BadRequestException('Appeal already decided');
    const ops = [
      this.prisma.appeal.update({ where: { id }, data: { status: dto.decision, decision: dto.note, decidedAt: new Date() } }),
    ] as any[];
    if (dto.decision === 'reopened') {
      ops.push(this.prisma.influencer.update({ where: { id: ap.action.influencerId }, data: { reviewDue: true, reviewDueReason: 'Appeal reopened' } }));
    }
    const [updated] = await this.prisma.$transaction(ops);
    return updated;
  }
}

@Controller('committee')
@UseGuards(StaffGuard)
@UseInterceptors(AuditInterceptor)
@StaffRoles('committee')
export class CommitteeController {
  constructor(private readonly committee: CommitteeService) {}

  @Get('queue')
  queue(@CurrentStaff() staff: User) {
    return this.committee.queue(staff);
  }

  @Post('conflicts')
  conflict(@CurrentStaff() staff: User, @Body() dto: ConflictDto) {
    return this.committee.declareConflict(staff, dto);
  }

  @Put('actions/:id/vote')
  vote(@CurrentStaff() staff: User, @Param('id') id: string, @Body() dto: VoteDto) {
    return this.committee.vote(staff, id, dto);
  }

  @Post('actions/:id/finalize')
  finalize(@Param('id') id: string, @Body() dto: FinalizeDto) {
    return this.committee.finalize(id, dto);
  }

  @Post('actions/:id/publish')
  publish(@Param('id') id: string) {
    return this.committee.publish(id);
  }

  @Patch('actions/:id/watch')
  watch(@Param('id') id: string, @Body() dto: WatchDto) {
    return this.committee.setWatch(id, dto);
  }

  @Get('appeals')
  appeals(@Query('status') status?: string) {
    return this.committee.appeals(status);
  }

  @Post('appeals/:id/decide')
  decide(@Param('id') id: string, @Body() dto: DecideAppealDto) {
    return this.committee.decideAppeal(id, dto);
  }
}

@Module({ controllers: [CommitteeController], providers: [CommitteeService] })
export class CommitteeModule {}
