import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthRateLimitGuard } from '../src/common/guards/auth-rate-limit.guard';
import { AuthService } from '../src/modules/auth/auth.service';

function authContext(body: object) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body,
        ip: '203.0.113.10',
        originalUrl: '/auth/customer/request-otp',
      }),
    }),
  } as never;
}

test('auth rate limiting uses the shared database bucket', async () => {
  let count = 0;
  const prisma = {
    $queryRaw: async () => [{ requestCount: ++count }],
    authRateLimit: { deleteMany: async () => ({ count: 0 }) },
  };
  const guard = new AuthRateLimitGuard(prisma as never);
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

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
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

  assert.deepEqual(sentOtps, [
    { mobileNumber: '9999999999', otp: '123456' },
  ]);
  assert.equal(await bcrypt.compare('123456', createdHashes[0]), true);
});
