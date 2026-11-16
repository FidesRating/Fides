import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { MembersModule } from './members/members.module';
import { PublicModule } from './public/public';
import { AdminModule } from './admin/admin';
import { CommitteeModule } from './committee/committee';
import { ClaimsModule } from './claims/claims';
import { ResearchModule } from './research/research';
import { SurveillanceModule } from './queue/surveillance';

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 100) }]),
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
        maxRetriesPerRequest: null,
      },
    }),
    MembersModule,
    PublicModule,
    AdminModule,
    CommitteeModule,
    ClaimsModule,
    ResearchModule,
    SurveillanceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
