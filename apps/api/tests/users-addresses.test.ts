import assert from 'node:assert/strict';
import test from 'node:test';
import { UsersService } from '../src/modules/users/users.service';

test('an address referenced by a cart is soft-deleted from saved addresses', async () => {
  const calls: string[] = [];
  const service = new UsersService({
    userAddress: {
      findFirst: async () => ({
        id: 'address-1',
        userId: 'user-1',
        isDefault: false,
      }),
    },
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        userAddress: {
          update: async ({ data }: { data: Record<string, unknown> }) => {
            assert.ok(data.deletedAt instanceof Date);
            assert.equal(data.isDefault, false);
            calls.push('soft-deleted');
          },
        },
      }),
  } as never);

  assert.deepEqual(await service.deleteAddress('user-1', 'address-1'), {
    success: true,
  });
  assert.deepEqual(calls, ['soft-deleted']);
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
          update: async ({ where }: { where: { id: string } }) =>
            calls.push(where.id === 'address-1' ? 'soft-deleted' : 'promoted'),
          findFirst: async () => ({ id: 'address-2' }),
        },
      }),
  } as never);

  assert.deepEqual(await service.deleteAddress('user-1', 'address-1'), {
    success: true,
  });
  assert.deepEqual(calls, ['soft-deleted', 'promoted']);
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
