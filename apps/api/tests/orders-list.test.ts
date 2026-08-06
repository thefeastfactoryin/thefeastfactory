import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from '../src/modules/orders/orders.service';

test('customer order history excludes pending-payment attempts', async () => {
  let where: unknown;
  const service = new OrdersService(
    {
      order: {
        findMany: async (query: { where: unknown }) => {
          where = query.where;
          return [];
        },
      },
    } as never,
    {} as never,
    {} as never,
  );

  assert.deepEqual(await service.list('user-1'), []);
  assert.deepEqual(where, {
    userId: 'user-1',
    orderStatus: { not: OrderStatus.PENDING_PAYMENT },
  });
});
