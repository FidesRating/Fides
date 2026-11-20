import {
  BadRequestException, Controller, Get, GoneException, Header, Injectable, Module, NotFoundException, Param, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { PublicCacheInterceptor } from './cache.interceptor';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentMember, MemberContext, OptionalMemberGuard } from '../common/auth.guards';
import { band, notch } from '../rating/rating.engine';
import { ALL_RATINGS, DISCLAIMER, METHODOLOGY_VERSION, OUTLOOK_TEXT, PILLARS, RULES, SCALE, WATCH_TEXT } from '../rating/methodology';
import { CHAIN_REGISTRY, explorerUrl } from '../config/explorer-registry';
import { formatActionId, num, presentAction } from './presenter';
import { activeWatch } from '../rating/watch';

export class ListRatingsDto {
  @IsOptional() @IsIn(['trusted', 'speculative', 'default', 'not_rated']) band?: string;
  @IsOptional() @IsIn(ALL_RATINGS) rating?: string;
  @IsOptional() @IsIn(['positive', 'stable', 'negative', 'developing']) outlook?: string;
  @IsOptional() @IsIn(['true', 'false']) watch?: string;
  @IsOptional() @IsIn(['rating', 'recent', 'followers']) sort?: string = 'rating';
}

export class ActionsFeedDto {
  @IsOptional() @IsIn(['new', 'upgrade', 'downgrade', 'affirm', 'withdraw']) type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 30;
}

const PUBLIC_CALLS = 10;

/** Followers of an influencer: the largest of its social accounts. */
const maxFollowers = (accounts: { followers: number }[]) => accounts.reduce((m, a) => Math.max(m, a.followers), 0);

/** Public provenance of evidence: link, hash and capture time only. Never the stored file path or the capturer. */
const SNAPSHOT_PUBLIC = { select: { sourceUrl: true, archiveUrl: true, contentHash: true, capturedAt: true }, orderBy: { capturedAt: 'asc' } } as const;

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  private async influencerOr410(handle: string) {
    const inf = await this.prisma.influencer.findUnique({
      where: { handle: handle.toLowerCase().replace(/^@/, '') },
      include: { accounts: { select: { platform: true, handle: true, followers: true } } },
    });
    if (!inf) throw new NotFoundException('Account not found');
    if (inf.status === 'removed') throw new GoneException('This account is no longer covered by FIDES');
    return inf;
  }

  private currentAction(influencerId: string) {
    return this.prisma.ratingAction.findFirst({
      where: { influencerId, status: 'published' },
      include: { reply: true, previous: { select: { rating: true } } },
    });
  }

  async list(q: ListRatingsDto) {
    const rows = await this.prisma.influencer.findMany({
      where: { status: { in: ['rated', 'not_rated'] }, actions: { some: { status: 'published' } } },
      include: {
        accounts: { select: { followers: true } },
        // Only the columns the list needs: the full row carries the scorecard inputs JSON.
        actions: {
          where: { status: 'published' },
          select: {
            actionNumber: true, type: true, rating: true, outlook: true, watch: true, watchSetAt: true, totalScore: true, publishedAt: true,
            accuracy: true, disclosure: true, walletAlignment: true, conduct: true, previous: { select: { rating: true } },
          },
        },
      },
    });
    let out = rows.map((i) => {
      const a = i.actions.at(0)!;
      const weakest = a.accuracy === null ? null : PILLARS.reduce((w, p) => ((a as any)[p.key] < (a as any)[w.key] ? p : w), PILLARS[0]).label;
      return {
        handle: i.handle, displayName: i.displayName, followers: maxFollowers(i.accounts), avatarUrl: i.avatarUrl, participating: i.participating,
        rating: a.rating!, band: band(a.rating!), outlook: a.outlook, watch: activeWatch(a), totalScore: a.totalScore, weakestPillar: weakest,
        lastAction: { actionId: formatActionId(a.actionNumber), type: a.type, previousRating: a.previous?.rating ?? null, publishedAt: a.publishedAt },
      };
    });
    if (q.band) out = out.filter((r) => r.band === q.band);
    if (q.rating) out = out.filter((r) => r.rating === q.rating);
    if (q.outlook) out = out.filter((r) => r.outlook === q.outlook);
    if (q.watch) out = out.filter((r) => (q.watch === 'true') === !!r.watch);
    const rank = (r: string) => (r === 'NR' ? 99 : notch(r));
    const sorters = {
      rating: (a, b) => rank(a.rating) - rank(b.rating) || (b.totalScore ?? 0) - (a.totalScore ?? 0),
      recent: (a, b) => +new Date(b.lastAction.publishedAt) - +new Date(a.lastAction.publishedAt),
      followers: (a, b) => b.followers - a.followers,
    };
    return out.sort(sorters[q.sort ?? 'rating']);
  }

  async report(handle: string, isHolder: boolean) {
    const inf = await this.influencerOr410(handle);
    const current = await this.currentAction(inf.id);
    if (!current) throw new NotFoundException('No published rating for this account yet');
    const [wallets, promotions, callCount, calls, history, pending] = await Promise.all([
      this.prisma.wallet.findMany({ where: { influencerId: inf.id } }),
      this.prisma.promotion.findMany({
        where: { influencerId: inf.id, status: 'confirmed' },
        include: { call: { select: { postUrl: true, tokenSymbol: true, postedAt: true } }, snapshots: SNAPSHOT_PUBLIC },
      }),
      this.prisma.call.count({ where: { influencerId: inf.id } }),
      this.calls(inf.id, isHolder ? undefined : PUBLIC_CALLS),
      this.historyOf(inf.id),
      this.prisma.ratingAction.count({ where: { influencerId: inf.id, status: { in: ['draft', 'committee', 'notice'] } } }),
    ]);
    const nextReview = new Date((current.publishedAt ?? new Date()).getTime() + RULES.fullReviewDays * 86400_000);
    return {
      account: {
        handle: inf.handle, displayName: inf.displayName, followers: maxFollowers(inf.accounts), avatarUrl: inf.avatarUrl,
        accounts: inf.accounts.map((a) => ({ platform: a.platform, handle: a.handle, followers: a.followers })),
        coverage: inf.participating ? 'Participating' : 'Unsolicited', underReview: pending > 0,
      },
      rating: presentAction(current, current.previous?.rating),
      nextFullReview: nextReview,
      evidence: {
        wallets: wallets.map((w) => ({
          chain: w.chainKey, chainName: CHAIN_REGISTRY[w.chainKey]?.displayName ?? w.chainKey, address: w.address,
          method: w.method, sourceUrl: w.sourceUrl, explorerUrl: explorerUrl(w.chainKey, w.address),
        })),
        paidPromotions: promotions.map((p) => ({
          source: p.source, evidenceUrl: p.evidenceUrl, disclosed: p.disclosed, amountUsd: num(p.amountUsd),
          call: p.call ? { postUrl: p.call.postUrl, token: p.call.tokenSymbol, postedAt: p.call.postedAt } : null,
          snapshots: p.snapshots,
        })),
      },
      calls: { total: callCount, shown: calls.length, fullAccess: isHolder, items: calls },
      history,
      disclaimer: DISCLAIMER,
    };
  }

  /** Call record. Public: the latest 10; holders: all. */
  async calls(influencerId: string, limit?: number) {
    const rows = await this.prisma.call.findMany({
      where: { influencerId },
      orderBy: { postedAt: 'desc' },
      take: limit,
      include: { promotions: { where: { status: 'confirmed' }, select: { disclosed: true } }, snapshots: SNAPSHOT_PUBLIC },
    });
    const ret = (p: unknown, base: unknown) => (p === null || base === null ? null : Math.round((num(p as any)! / num(base as any)! - 1) * 10000) / 10000);
    return rows.map((c) => {
      const r30 = ret(c.price30d, c.priceAtCall), b30 = ret(c.btc30d, c.btcAtCall);
      return {
        postedAt: c.postedAt, token: c.tokenSymbol, chain: c.chainKey, direction: c.direction,
        postUrl: c.deletedAt ? null : c.postUrl, archiveUrl: c.archiveUrl, deleted: !!c.deletedAt,
        return7d: ret(c.price7d, c.priceAtCall), return30d: r30, return90d: ret(c.price90d, c.priceAtCall),
        excessVsBtc30d: r30 === null || b30 === null ? null : Math.round(((c.direction === 'long' ? r30 - b30 : b30 - r30)) * 10000) / 10000,
        sponsoredDisclosed: c.sponsoredDisclosed,
        paidPromotion: c.promotions.length ? (c.promotions.some((p) => !p.disclosed) ? 'undisclosed' : 'disclosed') : null,
        rugConfirmed: !!c.projectRugConfirmedAt, retracted: !!c.retractedAt,
        priceSource: c.priceSource, snapshots: c.snapshots,
      };
    });
  }

  async callsByHandle(handle: string, isHolder: boolean) {
    const inf = await this.influencerOr410(handle);
    return { fullAccess: isHolder, items: await this.calls(inf.id, isHolder ? undefined : PUBLIC_CALLS) };
  }

  async history(handle: string) {
    const inf = await this.influencerOr410(handle);
    return this.historyOf(inf.id);
  }

  private async historyOf(influencerId: string) {
    const rows = await this.prisma.ratingAction.findMany({
      where: { influencerId, status: { in: ['published', 'superseded'] } },
      orderBy: { publishedAt: 'desc' },
      select: {
        actionNumber: true, type: true, rating: true, outlook: true, watch: true, watchSetAt: true, totalScore: true,
        publishedAt: true, status: true, previous: { select: { rating: true } },
      },
    });
    return rows.map((a) => ({
      actionId: formatActionId(a.actionNumber), type: a.type, rating: a.rating, previousRating: a.previous?.rating ?? null,
      outlook: a.outlook, watch: activeWatch(a), totalScore: a.totalScore, publishedAt: a.publishedAt, current: a.status === 'published',
    }));
  }

  async actions(q: ActionsFeedDto) {
    const rows = await this.prisma.ratingAction.findMany({
      where: { status: { in: ['published', 'superseded'] }, influencer: { status: { not: 'removed' } }, ...(q.type ? { type: q.type as any } : {}) },
      orderBy: { publishedAt: 'desc' },
      take: q.limit ?? 30,
      include: { influencer: { select: { handle: true, displayName: true, avatarUrl: true } }, previous: { select: { rating: true } } },
    });
    return rows.map((a) => ({
      actionId: formatActionId(a.actionNumber), type: a.type, handle: a.influencer.handle, displayName: a.influencer.displayName,
      avatarUrl: a.influencer.avatarUrl, rating: a.rating, previousRating: a.previous?.rating ?? null, outlook: a.outlook,
      watch: activeWatch(a), publishedAt: a.publishedAt,
    }));
  }

  /** Data for the share card of one published rating action: handle, old and new rating, outlook, type, date. */
  async actionCard(actionId: string) {
    const m = /^RA-(\d{1,8})$/i.exec(actionId);
    if (!m) throw new BadRequestException('actionId must look like RA-0001');
    const a = await this.prisma.ratingAction.findFirst({
      where: { actionNumber: Number(m[1]), status: { in: ['published', 'superseded'] } },
      select: {
        actionNumber: true, type: true, rating: true, outlook: true, publishedAt: true,
        previous: { select: { rating: true } },
        influencer: { select: { handle: true, displayName: true, status: true } },
      },
    });
    if (!a) throw new NotFoundException('Rating action not found');
    if (a.influencer.status === 'removed') throw new GoneException('This account is no longer covered by FIDES');
    return {
      actionId: formatActionId(a.actionNumber), type: a.type, handle: a.influencer.handle, displayName: a.influencer.displayName,
      rating: a.rating, band: a.rating ? band(a.rating) : null, previousRating: a.previous?.rating ?? null, outlook: a.outlook, publishedAt: a.publishedAt,
    };
  }

  /** Accounts being processed. Rating and score are not shown yet. */
  async underReview() {
    const rows = await this.prisma.ratingAction.findMany({
      where: { status: { in: ['draft', 'committee', 'notice'] }, influencer: { status: { not: 'removed' } } },
      orderBy: { createdAt: 'asc' },
      include: { influencer: { select: { handle: true, displayName: true } } },
    });
    const stage = { draft: 'Scorecard', committee: 'Committee', notice: 'Notice period' };
    return rows.map((a) => ({ handle: a.influencer.handle, displayName: a.influencer.displayName, stage: stage[a.status], since: a.createdAt }));
  }

  async stats() {
    const [rated, calls, actions, aaa] = await Promise.all([
      this.prisma.influencer.count({ where: { status: 'rated' } }),
      this.prisma.call.count({ where: { influencer: { status: { not: 'removed' } } } }),
      this.prisma.ratingAction.count({ where: { status: { in: ['published', 'superseded'] }, influencer: { status: { not: 'removed' } } } }),
      this.prisma.ratingAction.count({ where: { status: 'published', rating: 'AAA', influencer: { status: 'rated' } } }),
    ]);
    return { accountsRated: rated, callsTracked: calls, ratingActions: actions, aaaRatings: aaa };
  }

  async methodology() {
    const m = await this.prisma.methodologyVersion.findFirst({ where: { isCurrent: true } });
    return {
      version: m?.version ?? METHODOLOGY_VERSION,
      pillars: PILLARS,
      rules: RULES,
      changelog: m?.changelog,
      disclaimer: DISCLAIMER,
    };
  }

  scale() {
    return {
      ratings: SCALE.map((s) => ({ ...s, band: band(s.rating) })),
      special: [
        { rating: 'D', meaning: 'Default on trust: proven undisclosed paid promotion and a ≥50% sale of that token from a declared wallet within 7 days of the call.' },
        { rating: 'NR', meaning: `Not Rated: fewer than ${RULES.minCalls} calls, or rating withdrawn.` },
      ],
      outlooks: OUTLOOK_TEXT,
      watches: WATCH_TEXT,
    };
  }

  // ─────────────────────────── Research ───────────────────────────

  research(kind?: string) {
    return this.prisma.article.findMany({
      where: { publishedAt: { not: null, lte: new Date() }, influencers: { none: { status: 'removed' } }, ...(kind ? { kind: kind as any } : {}) },
      orderBy: { publishedAt: 'desc' },
      select: { slug: true, kind: true, title: true, standfirst: true, readMinutes: true, publishedAt: true, influencers: { select: { handle: true } } },
    });
  }

  async article(slug: string) {
    // Staff identities are never public: no author field. Articles about removed accounts are gone too.
    const a = await this.prisma.article.findFirst({
      where: { slug, influencers: { none: { status: 'removed' } } },
      include: { influencers: { select: { handle: true } } },
    });
    if (!a || !a.publishedAt || a.publishedAt > new Date()) throw new NotFoundException('Article not found');
    const { authorId, ...rest } = a;
    return rest;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const BAND_COLOR = { trusted: '#2f6b4f', speculative: '#c98c10', default: '#7c1522', not_rated: '#4a4f5799' };

@Controller()
@UseInterceptors(PublicCacheInterceptor)
export class PublicController {
  constructor(private readonly pub: PublicService) {}

  @Get('ratings')
  list(@Query() q: ListRatingsDto) {
    return this.pub.list(q);
  }

  @Get('ratings/:handle')
  @UseGuards(OptionalMemberGuard)
  report(@Param('handle') handle: string, @CurrentMember() mc: MemberContext | null) {
    return this.pub.report(handle, !!mc?.isHolder);
  }

  @Get('ratings/:handle/history')
  history(@Param('handle') handle: string) {
    return this.pub.history(handle);
  }

  @Get('ratings/:handle/calls')
  @UseGuards(OptionalMemberGuard)
  calls(@Param('handle') handle: string, @CurrentMember() mc: MemberContext | null) {
    return this.pub.callsByHandle(handle, !!mc?.isHolder);
  }

  @Get('actions')
  actions(@Query() q: ActionsFeedDto) {
    return this.pub.actions(q);
  }

  @Get('actions/:actionId')
  actionCard(@Param('actionId') actionId: string) {
    return this.pub.actionCard(actionId);
  }

  @Get('under-review')
  underReview() {
    return this.pub.underReview();
  }

  @Get('stats')
  stats() {
    return this.pub.stats();
  }

  @Get('methodology')
  methodology() {
    return this.pub.methodology();
  }

  @Get('scale')
  scale() {
    return this.pub.scale();
  }

  @Get('research')
  research(@Query('kind') kind?: string) {
    return this.pub.research(kind);
  }

  @Get('research/:slug')
  article(@Param('slug') slug: string) {
    return this.pub.article(slug);
  }

  /** Rating badge an influencer can embed. Neutral when not rated or removed. */
  @Get('badge/:file')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=3600')
  async badge(@Param('file') file: string) {
    const handle = file.replace(/\.svg$/, '');
    if (!/^[a-z0-9_]{1,15}$/i.test(handle)) throw new BadRequestException('Invalid handle');
    let rating = 'NR', outlook = '', color = BAND_COLOR.not_rated;
    try {
      const r = await this.pub.report(handle, false);
      rating = r.rating.rating!;
      outlook = r.rating.outlook ? `OUTLOOK ${r.rating.outlook.toUpperCase()}` : '';
      if (r.rating.watch) outlook = r.rating.watch.replace('_', ' ').toUpperCase();
      color = BAND_COLOR[band(rating)];
    } catch {
      /* not rated yet */
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="48" role="img" aria-label="FIDES rating ${esc(rating)} ${esc(outlook)}">
  <rect width="240" height="48" rx="10" fill="#f5f0e8" stroke="#4a4f5747"/>
  <text x="14" y="21" font-family="Georgia,serif" font-size="13" fill="#4a4f57">FIDES</text>
  <text x="14" y="36" font-family="monospace" font-size="8" fill="#4a4f5799">@${esc(handle.toLowerCase())}</text>
  <rect x="120" y="9" width="58" height="30" rx="6" fill="none" stroke="${color}" stroke-width="1.5"/>
  <text x="149" y="30" text-anchor="middle" font-family="Georgia,serif" font-size="17" font-weight="600" fill="${color}">${esc(rating)}</text>
  <text x="186" y="27" font-family="monospace" font-size="7" fill="#4a4f5799">${esc(outlook.slice(0, 18))}</text>
</svg>`;
  }
}

@Module({ controllers: [PublicController], providers: [PublicService], exports: [PublicService] })
export class PublicModule {}
