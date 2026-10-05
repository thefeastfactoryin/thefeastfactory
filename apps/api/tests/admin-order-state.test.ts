import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdminRole,
  BookingFulfilmentStatus,
  BookingStatus,
  OrderStatus,
  PaymentSource,
  PaymentStatus,
} from '@prisma/client';
import { AdminOrdersService } from '../src/modules/admin-orders/admin-orders.service';

test('booking fulfilment can jump directly to completed and synchronizes every package', async () => {
  let storedFulfilment = BookingFulfilmentStatus.NOT_STARTED;
  let storedBookingStatus = BookingStatus.CONFIRMED;
  const childStatuses = new Map([
    ['order-1', OrderStatus.CONFIRMED],
    ['order-2', OrderStatus.CONFIRMED],
  ]);
  const service = new AdminOrdersService(
    {
      booking: {
        findFirst: async () => ({
          id: 'booking-1',
          regionId: 'region-1',
          status: storedBookingStatus,
          fulfilmentStatus: storedFulfilment,
          orders: [...childStatuses].map(([id, orderStatus]) => ({
            id,
            orderStatus,
          })),
        }),
      },
      $transaction: async (callback: (tx: object) => Promise<void>) =>
        callback({
          booking: {
            updateMany: async ({
              data,
            }: {
              data: {
                status: BookingStatus;
                fulfilmentStatus: BookingFulfilmentStatus;
              };
            }) => {
              storedBookingStatus = data.status;
              storedFulfilment = data.fulfilmentStatus;
              return { count: 1 };
            },
          },
          bookingFulfilmentHistory: { create: async () => undefined },
          bookingStatusHistory: { create: async () => undefined },
          order: {
            update: async ({
              where,
              data,
            }: {
              where: { id: string };
              data: { orderStatus: OrderStatus };
            }) => {
              childStatuses.set(where.id, data.orderStatus);
            },
          },
          orderStatusHistory: { create: async () => undefined },
        }),
    } as never,
    {} as never,
    {} as never,
    { resolveAdminScope: async () => undefined } as never,
    {} as never,
  );
  service.getBooking = async () => ({ id: 'booking-1' }) as never;

  await service.updateBookingFulfilment(
    { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
    'booking-1',
    { status: BookingFulfilmentStatus.COMPLETED },
  );
  assert.equal(storedFulfilment, BookingFulfilmentStatus.COMPLETED);
  assert.equal(storedBookingStatus, BookingStatus.COMPLETED);
  assert.deepEqual(
    [...childStatuses.values()],
    [OrderStatus.DELIVERED, OrderStatus.DELIVERED],
  );
});

test('booking fulfilment cannot move backward after operations advance it', async () => {
  let transactionStarted = false;
  const service = new AdminOrdersService(
    {
      booking: {
        findFirst: async () => ({
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          fulfilmentStatus: BookingFulfilmentStatus.COMPLETED,
          orders: [],
        }),
      },
      $transaction: async () => {
        transactionStarted = true;
      },
    } as never,
    {} as never,
    {} as never,
    { resolveAdminScope: async () => undefined } as never,
    {} as never,
  );

  await assert.rejects(
    service.updateBookingFulfilment(
      { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
      'booking-1',
      { status: BookingFulfilmentStatus.NOT_STARTED },
    ),
    /Fulfilment status can only move forward/,
  );
  assert.equal(transactionStarted, false);
});

test('admin order detail uses the same complete menu as the customer order', async () => {
  const service = new AdminOrdersService(
    {
      order: {
        findUnique: async () => ({
          id: 'order-1',
          bookingId: 'booking-1',
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

  const order = await service.getOrder(
    { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
    'booking-1',
    'order-1',
  );
  assert.deepEqual(
    order.selectedItems.map((item: { id: string }) => item.id),
    ['included-1', 'extra-1'],
  );
});

test('declining a booking refunds every captured online partial payment', async () => {
  const refundedPaymentIds: string[] = [];
  let declinedStatus: BookingStatus | undefined;
  const service = new AdminOrdersService(
    {
      booking: {
        findFirst: async () => ({
          id: 'booking-1',
          regionId: 'region-1',
          status: BookingStatus.AWAITING_APPROVAL,
          orders: [
            { id: 'order-1', orderStatus: OrderStatus.AWAITING_APPROVAL },
          ],
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
          booking: {
            updateMany: async ({
              data,
            }: {
              data: { status: BookingStatus };
            }) => {
              declinedStatus = data.status;
              return { count: 1 };
            },
          },
          bookingStatusHistory: { create: async () => undefined },
          order: {
            update: async () => undefined,
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
  service.getBooking = async () => ({ id: 'booking-1' }) as never;

  const result = await service.declineBooking(
    { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
    'booking-1',
    { reason: 'Kitchen cannot fulfil this booking' },
  );

  assert.equal(declinedStatus, BookingStatus.DECLINED);
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
          booking: { regionId: 'region-1', status: BookingStatus.DECLINED },
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
          booking: { regionId: 'region-2', status: BookingStatus.DECLINED },
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
