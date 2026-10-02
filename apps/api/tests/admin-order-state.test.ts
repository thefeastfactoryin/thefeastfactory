import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { AdminRole, OrderStatus, PaymentStatus } from '@prisma/client';
import { AdminOrdersService } from '../src/modules/admin-orders/admin-orders.service';

test('pending-payment orders cannot bypass the kitchen approval flow', async () => {
  let updateCalls = 0;
  const service = new AdminOrdersService(
    {
      order: {
        findUnique: async () => ({
          id: 'order-1',
          regionId: 'region-1',
          orderStatus: OrderStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
        }),
      },
      $transaction: async () => {
        updateCalls += 1;
      },
    } as never,
    {} as never,
    {} as never,
    { resolveAdminScope: async () => undefined } as never,
  );

  await assert.rejects(
    service.updateStatus(
      { sub: 'admin-1', type: 'admin', role: AdminRole.SUPER_ADMIN },
      'order-1',
      { status: OrderStatus.CONFIRMED },
    ),
    (error: unknown) =>
      error instanceof BadRequestException &&
      /Cannot transition from PENDING_PAYMENT to CONFIRMED/.test(error.message),
  );
  assert.equal(updateCalls, 0);
});

test('kitchen can approve an unpaid booking request', async () => {
  let updatedStatus: OrderStatus | undefined;
  const service = new AdminOrdersService(
    {
      order: {
        findUnique: async () => ({
          id: 'order-1',
          regionId: 'region-1',
          orderStatus: OrderStatus.AWAITING_APPROVAL,
          paymentStatus: PaymentStatus.UNPAID,
        }),
        updateMany: async () => ({ count: 1 }),
      },
      orderStatusHistory: { create: async () => undefined },
      $transaction: async (callback: (tx: object) => Promise<void>) =>
        callback({
          order: {
            updateMany: async ({
              data,
            }: {
              data: { orderStatus: OrderStatus };
            }) => {
              updatedStatus = data.orderStatus;
              return { count: 1 };
            },
          },
          orderStatusHistory: { create: async () => undefined },
        }),
    } as never,
    { serializeOrder: (value: unknown) => value } as never,
    {} as never,
    { resolveAdminScope: async () => undefined } as never,
  );
  service.get = async () => ({ id: 'order-1' }) as never;

  await service.approve(
    { sub: 'admin-1', type: 'admin', role: AdminRole.SUPER_ADMIN },
    'order-1',
  );
  assert.equal(updatedStatus, OrderStatus.CONFIRMED);
});

test('stale admin status transitions cannot overwrite a concurrent change', async () => {
  let historyWrites = 0;
  const service = new AdminOrdersService(
    {
      order: {
        findUnique: async () => ({
          id: 'order-1',
          regionId: 'region-1',
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
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
    { resolveAdminScope: async () => undefined } as never,
  );

  await assert.rejects(
    service.updateStatus(
      { sub: 'admin-1', type: 'admin', role: AdminRole.SUPER_ADMIN },
      'order-1',
      { status: OrderStatus.IN_PROGRESS },
    ),
    /reload before trying again/,
  );
  assert.equal(historyWrites, 0);
});
