import {
  BadRequestException, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, Put, Query, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentMember, MemberContext, MemberGuard } from '../common/auth.guards';
import { activeWatch } from '../rating/watch';
import { formatActionId } from '../public/presenter';

/** A small cap keeps the table and the feed query cheap on the free plan. */
export const MAX_WATCHLIST = 50;

export class FeedDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 20;
}

/**
 * The Desk watchlist is an in-app list. It shows only what is already public: the published rating of each saved
 * account and its published rating actions. It never shows a rating before publication, and it sends nothing out.
 */
@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  private async coveredInfluencer(handle: string) {
    const inf = await this.prisma.influencer.findUnique({
      where: { handle: handle.toLowerCase().replace(/^@/, '') },
      select: { id: true, handle: true, status: true },
    });
    if (!inf || inf.status === 'removed') throw new NotFoundException('Account is not covered by FIDES');
    return inf;
  }

  async list(memberId: string) {
    const rows = await this.prisma.watchlistItem.findMany({
      where: { memberId, influencer: { status: { not: 'removed' } } },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        influencer: {
          select: {
            handle: true, displayName: true, avatarUrl: true,
            actions: { where: { status: 'published' }, take: 1, select: { actionNumber: true, rating: true, outlook: true, watch: true, watchSetAt: true, publishedAt: true } },
          },
        },
      },
    });
    return rows.map((r) => {
      const a = r.influencer.actions.at(0);
      return {
        handle: r.influencer.handle, displayName: r.influencer.displayName, avatarUrl: r.influencer.avatarUrl, addedAt: r.createdAt,
        current: a ? { actionId: formatActionId(a.actionNumber), rating: a.rating, outlook: a.outlook, watch: activeWatch(a), publishedAt: a.publishedAt } : null,
      };
    });
  }

  async add(memberId: string, handle: string) {
    const inf = await this.coveredInfluencer(handle);
    const existing = await this.prisma.watchlistItem.findUnique({ where: { memberId_influencerId: { memberId, influencerId: inf.id } } });
    if (existing) return { handle: inf.handle, saved: true };
    if ((await this.prisma.watchlistItem.count({ where: { memberId } })) >= MAX_WATCHLIST) {
      throw new BadRequestException(`The watchlist holds up to ${MAX_WATCHLIST} accounts`);
    }
    await this.prisma.watchlistItem.create({ data: { memberId, influencerId: inf.id } });
    return { handle: inf.handle, saved: true };
  }

  async remove(memberId: string, handle: string) {
    const inf = await this.prisma.influencer.findUnique({ where: { handle: handle.toLowerCase().replace(/^@/, '') }, select: { id: true } });
    if (inf) await this.prisma.watchlistItem.deleteMany({ where: { memberId, influencerId: inf.id } });
    return { success: true };
  }

  /** Published rating actions of the saved accounts, newest first. */
  async feed(memberId: string, limit = 20) {
    const rows = await this.prisma.ratingAction.findMany({
      where: {
        status: { in: ['published', 'superseded'] },
        influencer: { status: { not: 'removed' }, watchedBy: { some: { memberId } } },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        actionNumber: true, type: true, rating: true, outlook: true, publishedAt: true,
        previous: { select: { rating: true } },
        influencer: { select: { handle: true, displayName: true } },
      },
    });
    return rows.map((a) => ({
      actionId: formatActionId(a.actionNumber), type: a.type, handle: a.influencer.handle, displayName: a.influencer.displayName,
      rating: a.rating, previousRating: a.previous?.rating ?? null, outlook: a.outlook, publishedAt: a.publishedAt,
    }));
  }
}

const PRIVATE = ['Cache-Control', 'private, no-store'] as const;

@Controller('me/watchlist')
@UseGuards(MemberGuard)
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  @Header(...PRIVATE)
  list(@CurrentMember() mc: MemberContext) {
    return this.watchlist.list(mc.member.id);
  }

  @Get('feed')
  @Header(...PRIVATE)
  feed(@CurrentMember() mc: MemberContext, @Query() q: FeedDto) {
    return this.watchlist.feed(mc.member.id, q.limit);
  }

  @Put(':handle')
  @Header(...PRIVATE)
  add(@CurrentMember() mc: MemberContext, @Param('handle') handle: string) {
    return this.watchlist.add(mc.member.id, handle);
  }

  @Delete(':handle')
  @Header(...PRIVATE)
  remove(@CurrentMember() mc: MemberContext, @Param('handle') handle: string) {
    return this.watchlist.remove(mc.member.id, handle);
  }
}

@Module({ controllers: [WatchlistController], providers: [WatchlistService] })
export class WatchlistModule {}
