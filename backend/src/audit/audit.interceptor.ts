import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Records every successful non-GET staff request (admin and committee) in the AuditLog table.
 * Only the actor, the route pattern and the :id parameter are stored: no request bodies.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    if (req.method === 'GET') return next.handle();
    return next.handle().pipe(
      tap(() => {
        const route: string = req.route?.path ?? req.path;
        this.prisma.auditLog
          .create({ data: { staffId: req.staff?.id ?? null, action: `${req.method} ${route}`, entityId: req.params?.id ?? null } })
          .catch((e) => this.logger.warn(`Audit write failed: ${e.message}`));
      }),
    );
  }
}
