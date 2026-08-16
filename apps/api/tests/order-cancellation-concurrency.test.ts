import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from '../src/modules/orders/orders.service';

test('stale customer cancellation cannot overwrite a concurrent order transition', async () => {
  let historyWrites = 0;
  const service = new OrdersService(
    {
      order: {
        findFirst: async () => ({
          id: 'order-1',
          userId: 'user-1',
          orderStatus: OrderStatus.CONFIRMED,
        }),
      },
      $transaction: async (callback: (tx: object) => Promise<void>) =>
        callback({
          order: { updateMany: async () => ({ count: 0 }) },
          orderStatusHistory: {
            create: async () => {
              historyWrites += 1;
            },
          },
        }),
    } as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.cancel('user-1', 'order-1', { reason: 'Plans changed' }),
    /reload before trying again/,
  );
  assert.equal(historyWrites, 0);
});
