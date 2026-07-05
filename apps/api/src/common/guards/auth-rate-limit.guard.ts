import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 5;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private cleanupCounter = 0;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const route = request.originalUrl.split('?')[0];
    const identifier = this.identifier(request);
    const keyHash = createHash('sha256')
      .update(`${route}:${identifier}`)
      .digest('hex');
    const [bucket] = await this.prisma.$queryRaw<Array<{ requestCount: number }>>(
      Prisma.sql`
        INSERT INTO "auth_rate_limits"
          ("key_hash", "request_count", "expires_at", "updated_at")
        VALUES
          (${keyHash}, 1, NOW() + (${WINDOW_SECONDS} * INTERVAL '1 second'), NOW())
        ON CONFLICT ("key_hash") DO UPDATE SET
          "request_count" = CASE
            WHEN "auth_rate_limits"."expires_at" <= NOW() THEN 1
            ELSE "auth_rate_limits"."request_count" + 1
          END,
          "expires_at" = CASE
            WHEN "auth_rate_limits"."expires_at" <= NOW()
              THEN NOW() + (${WINDOW_SECONDS} * INTERVAL '1 second')
            ELSE "auth_rate_limits"."expires_at"
          END,
          "updated_at" = NOW()
        RETURNING "request_count" AS "requestCount"
      `,
    );

    this.cleanupCounter += 1;
    if (this.cleanupCounter >= 100) {
      this.cleanupCounter = 0;
      await this.prisma.authRateLimit.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } },
      });
    }

    if (!bucket || bucket.requestCount > MAX_REQUESTS) {
      throw new HttpException(
        'Too many authentication attempts. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private identifier(request: Request) {
    const body = request.body as
      | { mobileNumber?: unknown; email?: unknown }
      | undefined;
    const supplied = body?.mobileNumber ?? body?.email;
    return typeof supplied === 'string' && supplied.trim()
      ? supplied.trim().toLowerCase()
      : request.ip;
  }
}
