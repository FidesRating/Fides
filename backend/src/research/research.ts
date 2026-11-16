import { Body, Controller, Injectable, Module, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ArticleKind, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentStaff, StaffGuard, StaffRoles } from '../common/auth.guards';

export class UpsertArticleDto {
  @IsOptional() @Matches(/^[a-z0-9-]+$/) slug?: string;
  @IsOptional() @IsEnum(ArticleKind) kind?: ArticleKind;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(300) standfirst?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsInt() @Min(1) readMinutes?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) handles?: string[];
  @IsOptional() @IsBoolean() publish?: boolean;
}

@Injectable()
export class ResearchService {
  constructor(private readonly prisma: PrismaService) {}

  upsert(dto: UpsertArticleDto, staff: User, id?: string) {
    const { handles, publish, ...fields } = dto;
    const publishedAt = publish === true ? new Date() : publish === false ? null : undefined;
    const link = handles?.map((h) => ({ handle: h.replace(/^@/, '').toLowerCase() }));
    if (id) {
      return this.prisma.article.update({ where: { id }, data: { ...fields, publishedAt, influencers: link ? { set: link } : undefined } });
    }
    return this.prisma.article.create({
      data: {
        ...(fields as Required<Pick<UpsertArticleDto, 'slug' | 'kind' | 'title' | 'standfirst' | 'body'>>),
        publishedAt, authorId: staff.id, influencers: link ? { connect: link } : undefined,
      },
    });
  }
}

@Controller('research')
@UseGuards(StaffGuard)
@StaffRoles('analyst', 'committee')
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

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
