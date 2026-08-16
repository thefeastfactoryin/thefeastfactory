import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';
import { UsersService } from '../src/modules/users/users.service';

test('an address referenced by a cart cannot be deleted', async () => {
  let deleteCalls = 0;
  const service = new UsersService({
    userAddress: {
      findFirst: async () => ({
        id: 'address-1',
        userId: 'user-1',
        isDefault: true,
      }),
    },
    cart: { count: async () => 1 },
    order: { count: async () => 0 },
    $transaction: async () => {
      deleteCalls += 1;
    },
  } as never);

  await assert.rejects(
    service.deleteAddress('user-1', 'address-1'),
    ConflictException,
  );
  assert.equal(deleteCalls, 0);
});

test('deleting the default address atomically promotes the next address', async () => {
  const calls: string[] = [];
  const service = new UsersService({
    userAddress: {
      findFirst: async () => ({
        id: 'address-1',
        userId: 'user-1',
        isDefault: true,
      }),
    },
    cart: { count: async () => 0 },
    order: { count: async () => 0 },
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        userAddress: {
          delete: async () => calls.push('deleted'),
          findFirst: async () => ({ id: 'address-2' }),
          update: async () => calls.push('promoted'),
        },
      }),
  } as never);

  assert.deepEqual(
    await service.deleteAddress('user-1', 'address-1'),
    { success: true },
  );
  assert.deepEqual(calls, ['deleted', 'promoted']);
});

test('address updates cannot directly unset the default flag', () => {
  const service = new UsersService({} as never);
  const internal = service as unknown as {
    toAddressUpdateInput(dto: { isDefault?: boolean }): Record<string, unknown>;
  };

  assert.deepEqual(internal.toAddressUpdateInput({ isDefault: false }), {});
  assert.deepEqual(internal.toAddressUpdateInput({ isDefault: true }), {
    isDefault: true,
  });
});
