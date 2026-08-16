import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from '../src/modules/auth/auth.service';

function authService(prisma: object, provider: object, settings: object = {}) {
  return new AuthService(
    {
      get: (key: string, fallback: unknown) =>
        key === 'BCRYPT_SALT_ROUNDS' ? 1 : fallback,
    } as never,
    {} as never,
    provider as never,
    { ...prisma, platformSetting: settings } as never,
  );
}

test('a failed OTP delivery removes the undelivered verification record', async () => {
  const deleted: string[] = [];
  const deliveryError = new Error('SMS unavailable');
  const service = authService(
    {
      otpVerification: {
        create: async () => ({ id: 'otp-1' }),
        delete: async ({ where }: { where: { id: string } }) =>
          deleted.push(where.id),
      },
    },
    { sendOtp: async () => Promise.reject(deliveryError) },
    { findUnique: async () => null },
  );

  await assert.rejects(
    service.requestCustomerOtp({ mobileNumber: '919999999999' }),
    deliveryError,
  );
  assert.deepEqual(deleted, ['otp-1']);
});

test('invalid positive-integer security settings fall back safely', async () => {
  for (const value of ['not-a-number', '5minutes', '0', '-5']) {
    const service = authService(
      {},
      {},
      { findUnique: async () => ({ value }) },
    );
    const internal = service as unknown as {
      getIntSetting(key: string, fallback: number): Promise<number>;
    };
    assert.equal(await internal.getIntSetting('otp_max_attempts', 5), 5);
  }
});
