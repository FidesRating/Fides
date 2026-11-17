import {
  Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, BadRequestException, Param, Post, Query, ServiceUnavailableException,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TakedownStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { StaffGuard, StaffRoles } from '../common/auth.guards';

/** Past this many open requests the form stops accepting new ones, so spam cannot grow the free-plan database. */
export const MAX_OPEN_REQUESTS = 1000;

export class TakedownRequestDto {
  @Matches(/^@?[A-Za-z0-9_]{1,15}$/) handle: string;
  @IsString() @MinLength(10) @MaxLength(1000) reason: string;
  @IsOptional() @IsString() @MaxLength(200) contact?: string;
}

export class ReviewTakedownDto {
  @IsIn(['accepted', 'rejected']) status: 'accepted' | 'rejected';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

@Injectable()
export class TakedownService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stores a request. The answer is the same whether or not the account is covered and whether or not a request
   * is already open, so the form cannot be used to find out who is rated.
   */
  async submit(dto: TakedownRequestDto) {
    const handle = dto.handle.replace(/^@/, '').toLowerCase();
    const open = await this.prisma.takedownRequest.count({ where: { status: 'new' } });
    if (open >= MAX_OPEN_REQUESTS) throw new ServiceUnavailableException('Requests are paused. Try again later.');
    const duplicate = await this.prisma.takedownRequest.findFirst({ where: { handle, status: 'new' }, select: { id: true } });
    if (!duplicate) {
      await this.prisma.takedownRequest.create({ data: { handle, reason: dto.reason.trim(), contact: dto.contact?.trim() || null } });
    }
    return { success: true, message: 'Request received. The team reviews every request against the coverage rules.' };
  }

  async list(status?: TakedownStatus) {
    const rows = await this.prisma.takedownRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    const influencers = await this.prisma.influencer.findMany({
      where: { handle: { in: rows.map((r) => r.handle) } },
      select: { id: true, handle: true, status: true },
    });
    const byHandle = new Map(influencers.map((i) => [i.handle, i]));
    return rows.map((r) => ({ ...r, account: byHandle.get(r.handle) ?? null }));
  }

  /** Records the decision. Removing an account stays a separate admin action (POST /admin/influencers/:id/remove). */
  async review(id: string, dto: ReviewTakedownDto) {
    const r = await this.prisma.takedownRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    if (r.status !== 'new') throw new BadRequestException('Request already reviewed');
    return this.prisma.takedownRequest.update({ where: { id }, data: { status: dto.status, decisionNote: dto.note ?? null, decidedAt: new Date() } });
  }
}

@Controller('takedown-requests')
export class TakedownPublicController {
  constructor(private readonly takedown: TakedownService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 3600_000 } })
  submit(@Body() dto: TakedownRequestDto) {
    return this.takedown.submit(dto);
  }
}

@Controller('admin/takedown-requests')
@UseGuards(StaffGuard)
@UseInterceptors(AuditInterceptor)
@StaffRoles('analyst')
export class TakedownStaffController {
  constructor(private readonly takedown: TakedownService) {}

  @Get()
  list(@Query('status') status?: TakedownStatus) {
    return this.takedown.list(status);
  }

  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewTakedownDto) {
    return this.takedown.review(id, dto);
  }
}

@Module({ controllers: [TakedownPublicController, TakedownStaffController], providers: [TakedownService] })
export class TakedownModule {}
