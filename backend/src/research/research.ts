import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ArticleKind, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentStaff, StaffGuard, StaffRoles } from '../common/auth.guards';
import { AuditInterceptor } from '../audit/audit.interceptor';

export class UpsertArticleDto {
  @IsOptional() @Matches(/^[a-z0-9-]+$/) @MaxLength(80) slug?: string;
  @IsOptional() @IsEnum(ArticleKind) kind?: ArticleKind;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(300) standfirst?: string;
  /** Plain text. Capped to keep the database small (free plan). */
  @IsOptional() @IsString() @MaxLength(20000) body?: string;
  @IsOptional() @IsInt() @Min(1) readMinutes?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) handles?: string[];
  @IsOptional() @IsBoolean() publish?: boolean;
}

const REQUIRED = ['slug', 'kind', 'title', 'standfirst', 'body'] as const;

@Injectable()
export class ResearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** Staff view: drafts and published articles, newest first, latest 50. Staff identities are never returned. */
  list() {
    return this.prisma.article.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true, slug: true, kind: true, title: true, standfirst: true, body: true, readMinutes: true, publishedAt: true, updatedAt: true,
        influencers: { select: { handle: true } },
      },
    });
  }

  private async links(handles?: string[]) {
    if (!handles) return undefined;
    const wanted = [...new Set(handles.map((h) => h.replace(/^@/, '').toLowerCase()).filter(Boolean))];
    const found = await this.prisma.influencer.findMany({ where: { handle: { in: wanted } }, select: { handle: true } });
    const missing = wanted.filter((h) => !found.some((f) => f.handle === h));
    if (missing.length) throw new BadRequestException(`Unknown account: ${missing.map((m) => `@${m}`).join(', ')}`);
    return wanted.map((handle) => ({ handle }));
  }

  async upsert(dto: UpsertArticleDto, staff: User, id?: string) {
    try {
      return await this.save(dto, staff, id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException('This slug is already used by another article');
      throw e;
    }
  }

  private async save(dto: UpsertArticleDto, staff: User, id?: string) {
    const { handles, publish, ...fields } = dto;
    const publishedAt = publish === true ? new Date() : publish === false ? null : undefined;
    const link = await this.links(handles);
    if (id) {
      if (!(await this.prisma.article.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Article not found');
      // Keep the original publication time when an already published article is edited and published again.
      const keep = publish === true ? (await this.prisma.article.findUnique({ where: { id }, select: { publishedAt: true } }))?.publishedAt : undefined;
      return this.prisma.article.update({
        where: { id },
        data: { ...fields, publishedAt: keep ?? publishedAt, influencers: link ? { set: link } : undefined },
      });
    }
    const missing = REQUIRED.filter((k) => !fields[k]);
    if (missing.length) throw new BadRequestException(`Missing: ${missing.join(', ')}`);
    return this.prisma.article.create({
      data: {
        ...(fields as Required<Pick<UpsertArticleDto, 'slug' | 'kind' | 'title' | 'standfirst' | 'body'>>),
        readMinutes: fields.readMinutes,
        publishedAt, authorId: staff.id, influencers: link ? { connect: link } : undefined,
      },
    });
  }
}

@Controller('research')
@UseGuards(StaffGuard)
@StaffRoles('analyst', 'committee')
@UseInterceptors(AuditInterceptor)
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Get('staff/list')
  list() {
    return this.research.list();
  }

  @Post()
  create(@Body() dto: UpsertArticleDto, @CurrentStaff() staff: User) {
    return this.research.upsert(dto, staff);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertArticleDto, @CurrentStaff() staff: User) {
    return this.research.upsert(dto, staff, id);
  }
}

@Module({ controllers: [ResearchController], providers: [ResearchService] })
export class ResearchModule {}
