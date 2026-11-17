import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/** Liveness check for Railway. It does not query the database, so it never wakes a paused free-plan project. */
@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  @Header('Cache-Control', 'no-store')
  ok() {
    return { status: 'ok' };
  }
}
