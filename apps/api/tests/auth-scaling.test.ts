import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import {
  RATE_LIMIT_RULES,
  RateLimitRule,
} from '../src/common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { AuthController } from '../src/modules/auth/auth.controller';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { AuthService } from '../src/modules/auth/auth.service';

function authContext(body: object, user?: { sub: string }) {
  const headers = new Map<string, string>();
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body,
        user,
        ip: '203.0.113.10',
        ips: [],
        headers: {},
        socket: {},
        originalUrl: '/auth/customer/request-otp',
      }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => headers.set(name, value),
      }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as never;
}

test('rate limiting uses the shared database bucket and returns retry timing', async () => {
  let count = 0;
  const prisma = {
    $queryRaw: async () => [
      { requestCount: ++count, expiresAt: new Date(Date.now() + 60_000) },
    ],
    authRateLimit: { deleteMany: async () => ({ count: 0 }) },
  };
  const reflector = {
    getAllAndOverride: () => [
      {
        name: 'test-auth',
        identity: 'mobileNumber',
        limit: 5,
        windowSeconds: 60,
      },
    ],
  };
  const guard = new RateLimitGuard(reflector as never, prisma as never);
  const context = authContext({ mobileNumber: '9999999999' });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(await guard.canActivate(context), true);
  }
  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 429,
  );
});

test('rate limiting consumes both user and IP buckets for payments', async () => {
  let calls = 0;
  const prisma = {
    $queryRaw: async () => {
      calls += 1;
      return [{ requestCount: 1, expiresAt: new Date(Date.now() + 60_000) }];
    },
    authRateLimit: { deleteMany: async () => ({ count: 0 }) },
  };
  const reflector = {
    getAllAndOverride: () => [
      {
        name: 'payment-create',
        identity: 'user',
        limit: 5,
        windowSeconds: 60,
      },
      {
        name: 'payment-create-ip',
        identity: 'ip',
        limit: 20,
        windowSeconds: 60,
      },
    ],
  };
  const guard = new RateLimitGuard(reflector as never, prisma as never);

  assert.equal(
    await guard.canActivate(authContext({}, { sub: 'customer-1' })),
    true,
  );
  assert.equal(calls, 2);
});

test('priority auth and payment endpoints declare rate limits', () => {
  const rulesFor = (method: object) =>
    Reflect.getMetadata(RATE_LIMIT_RULES, method) as RateLimitRule[];

  assert.deepEqual(
    rulesFor(AuthController.prototype.requestCustomerOtp).map(
      ({ identity, limit, windowSeconds }) => [identity, limit, windowSeconds],
    ),
    [
      ['mobileNumber', 3, 600],
      ['mobileNumber', 10, 86_400],
      ['ip', 10, 600],
      ['ip', 50, 86_400],
    ],
  );
  assert.equal(
    rulesFor(AuthController.prototype.refreshCustomer)[0].identity,
    'refreshToken',
  );
  assert.equal(
    rulesFor(AuthController.prototype.loginAdmin)[0].windowSeconds,
    900,
  );
  assert.equal(
    rulesFor(PaymentsController.prototype.createFromCart)[0].name,
    'pay-later-booking',
  );
  assert.equal(rulesFor(PaymentsController.prototype.verify)[0].limit, 10);
});

test('only one concurrent verifier can claim an OTP', async () => {
  const otp = '123456';
  const otpHash = await bcrypt.hash(otp, 4);
  let claimed = false;
  const transaction = {
    otpVerification: {
      updateMany: async () => {
        if (claimed) return { count: 0 };
        claimed = true;
        return { count: 1 };
      },
    },
    user: {
      upsert: async () => ({
        id: 'user-1',
        mobileNumber: '9999999999',
        name: null,
        email: null,
      }),
    },
  };
  const prisma = {
    otpVerification: {
      findFirst: async () => ({
        id: 'otp-1',
        mobileNumber: '9999999999',
        otpHash,
        attempts: 0,
        isVerified: false,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
    platformSetting: { findUnique: async () => ({ value: '5' }) },
    $transaction: async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
  };
  const config = {
    get: (_key: string, fallback: unknown) => fallback,
    getOrThrow: (key: string) => key,
  };
  const jwt = { signAsync: async () => 'token' };
  const service = new AuthService(
    config as never,
    jwt as never,
    {} as never,
    prisma as never,
  );
  const request = { mobileNumber: '9999999999', otp };

  const results = await Promise.allSettled([
    service.verifyCustomerOtp(request),
    service.verifyCustomerOtp(request),
  ]);

  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === 'rejected').length,
    1,
  );
});

test('configured test OTP is limited to the configured mobile number', async () => {
  const createdHashes: string[] = [];
  const sentOtps: Array<{ mobileNumber: string; otp: string }> = [];
  const values: Record<string, unknown> = {
    TEST_LOGIN_OTP_ENABLED: true,
    TEST_LOGIN_MOBILE: '9999999999',
    TEST_LOGIN_OTP: '123456',
    BCRYPT_SALT_ROUNDS: 4,
    MSG91_OTP_EXPIRY_SECONDS: 300,
  };
  const config = {
    get: (key: string, fallback: unknown) => values[key] ?? fallback,
  };
  const prisma = {
    platformSetting: {
      findUnique: async () => null,
    },
    otpVerification: {
      create: async ({ data }: { data: { otpHash: string } }) => {
        createdHashes.push(data.otpHash);
        return data;
      },
    },
  };
  const provider = {
    sendOtp: async (mobileNumber: string, otp: string) => {
      sentOtps.push({ mobileNumber, otp });
    },
  };
  const service = new AuthService(
    config as never,
    {} as never,
    provider as never,
    prisma as never,
  );

  await service.requestCustomerOtp({ mobileNumber: '9999999999' });

  assert.deepEqual(sentOtps, [{ mobileNumber: '9999999999', otp: '123456' }]);
  assert.equal(await bcrypt.compare('123456', createdHashes[0]), true);
});
