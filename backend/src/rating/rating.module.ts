import { Module } from '@nestjs/common';
import { ScorecardService } from './scorecard.service';

@Module({ providers: [ScorecardService], exports: [ScorecardService] })
export class RatingModule {}
