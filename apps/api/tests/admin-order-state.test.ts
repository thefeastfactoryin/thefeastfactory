import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  AdminRole,
  OrderStatus,
  PaymentSource,
  PaymentStatus,
} from '@prisma/client';
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

test('admin order detail uses the same complete menu as the customer order', async () => {
  const service = new AdminOrdersService(
    {
      order: {
        findUnique: async () => ({
          id: 'order-1',
          userId: 'user-1',
          regionId: 'region-1',
          orderStatus: OrderStatus.AWAITING_APPROVAL,
        }),
      },
    } as never,
    {
      serializeOrder: () => ({ selectedItems: [{ id: 'extra-1' }] }),
      get: async () => ({
        selectedItems: [{ id: 'included-1' }, { id: 'extra-1' }],
      }),
    } as never,
    {} as never,
    { resolveAdminScope: async () => undefined } as never,
  );

  const order = await service.get(
    { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
    'order-1',
  );
  assert.deepEqual(
    order.selectedItems.map((item: { id: string }) => item.id),
    ['included-1', 'extra-1'],
  );
});

test('declining a booking refunds every captured online partial payment', async () => {
  const refundedPaymentIds: string[] = [];
  let declinedStatus: OrderStatus | undefined;
  const service = new AdminOrdersService(
    {
      order: {
        findUnique: async () => ({
          id: 'order-1',
          userId: 'user-1',
          regionId: 'region-1',
          orderStatus: OrderStatus.AWAITING_APPROVAL,
          payments: [
            {
              id: 'online-part-1',
              source: PaymentSource.RAZORPAY,
              paymentStatus: PaymentStatus.PAID,
              refunds: [],
            },
            {
              id: 'online-part-2',
              source: PaymentSource.RAZORPAY,
              paymentStatus: PaymentStatus.PAID,
              refunds: [],
            },
            {
              id: 'manual-part',
              source: PaymentSource.MANUAL,
              paymentStatus: PaymentStatus.PAID,
              refunds: [],
            },
          ],
        }),
      },
      $transaction: async (callback: (tx: object) => Promise<void>) =>
        callback({
          order: {
            updateMany: async ({
              data,
            }: {
              data: { orderStatus: OrderStatus };
            }) => {
              declinedStatus = data.orderStatus;
              return { count: 1 };
            },
          },
          orderStatusHistory: { create: async () => undefined },
        }),
    } as never,
    { serializeOrder: (value: unknown) => value } as never,
    {
      createRefund: async (_adminId: string, paymentId: string) => {
        refundedPaymentIds.push(paymentId);
      },
    } as never,
    { resolveAdminScope: async () => undefined } as never,
  );
  service.get = async () => ({ id: 'order-1' }) as never;

  const result = await service.decline(
    { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
    'order-1',
    { reason: 'Kitchen cannot fulfil this booking' },
  );

  assert.equal(declinedStatus, OrderStatus.DECLINED);
  assert.deepEqual(refundedPaymentIds, ['online-part-1', 'online-part-2']);
  assert.equal(result.refundRequired, true);
  assert.equal(result.manualRefundRequired, true);
  assert.equal(result.automaticRefundFailed, false);
});

test('only assigned kitchen Operations can invoke the refund endpoint', async () => {
  const refunded: string[] = [];
  const service = new AdminOrdersService(
    {
      payment: {
        findUnique: async () => ({
          id: 'payment-1',
          order: { regionId: 'region-1', orderStatus: OrderStatus.DECLINED },
        }),
      },
    } as never,
    {} as never,
    {
      createRefund: async (_adminId: string, paymentId: string) => {
        refunded.push(paymentId);
        return { id: 'refund-1' };
      },
    } as never,
    { resolveAdminScope: async () => 'region-1' } as never,
  );

  await assert.rejects(
    service.refund(
      { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
      'payment-1',
      { reason: 'Declined booking' },
    ),
    /Only kitchen Operations/,
  );
  assert.deepEqual(refunded, []);

  const result = await service.refund(
    { sub: 'operations-1', type: 'admin', role: AdminRole.OPERATIONS },
    'payment-1',
    { reason: 'Declined booking' },
  );
  assert.deepEqual(result, { id: 'refund-1' });
  assert.deepEqual(refunded, ['payment-1']);
});

test('Operations cannot refund a payment from another kitchen', async () => {
  let refundCalls = 0;
  const service = new AdminOrdersService(
    {
      payment: {
        findUnique: async () => ({
          id: 'payment-elsewhere',
          order: { regionId: 'region-2', orderStatus: OrderStatus.DECLINED },
        }),
      },
    } as never,
    {} as never,
    {
      createRefund: async () => {
        refundCalls += 1;
      },
    } as never,
    { resolveAdminScope: async () => 'region-1' } as never,
  );

  await assert.rejects(
    service.refund(
      { sub: 'operations-1', type: 'admin', role: AdminRole.OPERATIONS },
      'payment-elsewhere',
      { reason: 'Declined booking' },
    ),
    /Payment not found/,
  );
  assert.equal(refundCalls, 0);
});
