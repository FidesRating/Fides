import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Lets a CDN or the Next.js server cache anonymous public responses for a short time, which cuts database
 * reads and egress. Requests that carry a session or API key (holders see more data) are never shared-cached.
 */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    if (!res.getHeader('Cache-Control')) {
      const personalised = req.headers['authorization'] || req.headers['x-api-key'];
      res.setHeader('Cache-Control', personalised ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300');
      res.setHeader('Vary', 'Authorization, X-Api-Key');
    }
    return next.handle();
  }
}
