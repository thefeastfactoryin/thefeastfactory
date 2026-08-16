import assert from 'node:assert/strict';
import test from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';

function strategy(prisma: object) {
  return new JwtStrategy(
    { getOrThrow: () => 'test-access-secret' } as never,
    prisma as never,
  );
}

test('access tokens are rejected immediately after customer deactivation', async () => {
  const jwt = strategy({ user: { findFirst: async () => null } });
  await assert.rejects(
    jwt.validate({ sub: 'user-1', type: 'customer' }),
    UnauthorizedException,
  );
});

test('admin authorization claims use the current database role and region', async () => {
  const jwt = strategy({
    adminUser: {
      findFirst: async () => ({
        role: AdminRole.OPERATIONS,
        regionId: 'region-current',
      }),
    },
  });

  assert.deepEqual(
    await jwt.validate({
      sub: 'admin-1',
      type: 'admin',
      role: AdminRole.ADMIN,
      regionId: 'region-stale',
    }),
    {
      sub: 'admin-1',
      type: 'admin',
      role: AdminRole.OPERATIONS,
      regionId: 'region-current',
    },
  );
});
