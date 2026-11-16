import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RULES } from '../rating/methodology';
import { notch } from '../rating/rating.engine';
import { ScorecardService } from '../rating/scorecard.service';
import { RatingModule } from '../rating/rating.module';

export const SURVEILLANCE_QUEUE = 'surveillance';

@Injectable()
export class SurveillanceService {
  private readonly logger = new Logger(SurveillanceService.name);

  constructor(private readonly prisma: PrismaService, private readonly scorecard: ScorecardService) {}

  /**
   * Flag accounts that need to go back to the committee:
   *  - review penuh jatuh tempo (≥ 180 hari sejak terbit)
   *  - the latest scorecard differs by at least 1 notch from the published rating
   *  - a Rating Watch is still unresolved after 90 days
   */
  async sweep(now = new Date()) {
    const published = await this.prisma.ratingAction.findMany({
      where: { status: 'published', influencer: { status: { in: ['rated', 'not_rated'] } } },
      include: { influencer: true },
    });
    let flagged = 0;
    for (const a of published) {
      const reasons: string[] = [];
      if (a.publishedAt && now.getTime() - a.publishedAt.getTime() >= RULES.fullReviewDays * 86400_000) reasons.push('Full review due');
      if (a.watch && a.watchSetAt && now.getTime() - a.watchSetAt.getTime() >= RULES.watchMaxDays * 86400_000) reasons.push('Rating Watch older than 90 days');
      const sc = await this.scorecard.compute(a.influencerId, now);
      const cur = a.rating!, next = sc.scorecardRating;
      const drift = cur === 'NR' || next === 'NR' ? cur !== next : Math.abs(notch(next) - notch(cur)) >= 1;
      if (drift) reasons.push(`Scorecard now ${next} (published ${cur})`);
      if (reasons.length && !a.influencer.reviewDue) {
        await this.prisma.influencer.update({ where: { id: a.influencerId }, data: { reviewDue: true, reviewDueReason: reasons.join('; ') } });
        flagged++;
      }
    }
    if (flagged) this.logger.log(`Surveillance flagged ${flagged} account(s) for committee review`);
    return { checked: published.length, flagged };
  }
}

@Processor(SURVEILLANCE_QUEUE)
export class SurveillanceProcessor extends WorkerHost {
  constructor(private readonly surveillance: SurveillanceService) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'sweep') return this.surveillance.sweep();
  }
}

/** Daily job. Outside production, without Redis it falls back to an in-process timer. Production requires Redis. */
@Injectable()
export class SurveillanceScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SurveillanceScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(@InjectQueue(SURVEILLANCE_QUEUE) private readonly queue: Queue, private readonly surveillance: SurveillanceService) {}

  async onApplicationBootstrap() {
    if (process.env.MAINTENANCE_DISABLED === 'true') return;
    try {
      await Promise.race([
        this.queue.upsertJobScheduler('sweep', { pattern: '29 5 * * *' }, { name: 'sweep' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
      ]);
      this.logger.log('Surveillance job scheduled in BullMQ');
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(`BullMQ unavailable (${e.message}); surveillance is NOT scheduled`);
        return;
      }
      this.logger.warn(`BullMQ unavailable (${e.message}); running surveillance in-process every 24h`);
      this.timer = setInterval(() => this.surveillance.sweep().catch((err) => this.logger.error(err)), 24 * 3600_000);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}

@Module({
  imports: [RatingModule, BullModule.registerQueue({ name: SURVEILLANCE_QUEUE })],
  providers: [SurveillanceService, SurveillanceProcessor, SurveillanceScheduler],
})
export class SurveillanceModule {}
