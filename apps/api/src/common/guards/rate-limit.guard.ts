import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { JwtPayload } from '../auth/jwt-payload';
import {
  RATE_LIMIT_RULES,
  RateLimitIdentity,
  RateLimitRule,
} from '../decorators/rate-limit.decorator';
import { PrismaService } from '../../prisma/prisma.service';

type RateLimitRequest = Request & { user?: JwtPayload };
type RateLimitBucket = { requestCount: number; expiresAt: Date };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private cleanupCounter = 0;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[]>(
      RATE_LIMIT_RULES,
      [context.getHandler(), context.getClass()],
    );
    if (!rules?.length) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<RateLimitRequest>();
    const response = http.getResponse<Response>();

    for (const rule of rules) {
      if (!this.applies(request, rule)) continue;
      const identifier = this.identifier(request, rule.identity);
      if (!identifier) continue;

      const keyHash = createHash('sha256')
        .update(`${rule.name}:${rule.identity}:${identifier}`)
        .digest('hex');
      const [bucket] = await this.prisma.$queryRaw<RateLimitBucket[]>(
        Prisma.sql`
          INSERT INTO "auth_rate_limits"
            ("key_hash", "request_count", "expires_at", "updated_at")
          VALUES
            (${keyHash}, 1, NOW() + (${rule.windowSeconds} * INTERVAL '1 second'), NOW())
          ON CONFLICT ("key_hash") DO UPDATE SET
            "request_count" = CASE
              WHEN "auth_rate_limits"."expires_at" <= NOW() THEN 1
              ELSE "auth_rate_limits"."request_count" + 1
            END,
            "expires_at" = CASE
              WHEN "auth_rate_limits"."expires_at" <= NOW()
                THEN NOW() + (${rule.windowSeconds} * INTERVAL '1 second')
              ELSE "auth_rate_limits"."expires_at"
            END,
            "updated_at" = NOW()
          RETURNING
            "request_count" AS "requestCount",
            "expires_at" AS "expiresAt"
        `,
      );

      if (!bucket || bucket.requestCount > rule.limit) {
        const retryAfter = Math.max(
          1,
          Math.ceil(
            (new Date(bucket?.expiresAt ?? Date.now()).getTime() - Date.now()) /
              1000,
          ),
        );
        response.setHeader('Retry-After', String(retryAfter));
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: 'Too many requests. Please try again shortly.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    this.cleanupCounter += 1;
    if (this.cleanupCounter >= 100) {
      this.cleanupCounter = 0;
      await this.prisma.authRateLimit.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } },
      });
    }

    return true;
  }

  private identifier(request: RateLimitRequest, identity: RateLimitIdentity) {
    const body = request.body as Record<string, unknown> | undefined;
    let supplied: unknown;

    switch (identity) {
      case 'ip':
        // With proxy trust disabled, Express reports the proxy itself as the
        // client. Skip this secondary bucket instead of rate limiting every
        // customer together; identity limits remain active until configured.
        if (request.headers['x-forwarded-for'] && request.ips.length === 0) {
          return undefined;
        }
        supplied = request.ip || request.socket.remoteAddress;
        break;
      case 'user':
        supplied = request.user?.sub;
        break;
      default:
        supplied = body?.[identity];
    }

    if (typeof supplied !== 'string' || !supplied.trim()) return undefined;
    const normalized = supplied.trim();
    return identity === 'email' ? normalized.toLowerCase() : normalized;
  }

  private applies(request: RateLimitRequest, rule: RateLimitRule) {
    if (!rule.when) return true;
    const body = request.body as Record<string, unknown> | undefined;
    return body?.[rule.when.bodyField] === rule.when.equals;
  }
}
