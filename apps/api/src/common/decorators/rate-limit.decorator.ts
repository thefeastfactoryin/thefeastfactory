import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_RULES = 'rate-limit-rules';

export type RateLimitIdentity =
  | 'ip'
  | 'mobileNumber'
  | 'email'
  | 'refreshToken'
  | 'user';

export type RateLimitRule = {
  name: string;
  identity: RateLimitIdentity;
  limit: number;
  windowSeconds: number;
  when?: { bodyField: string; equals: string };
};

export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_RULES, rules);
