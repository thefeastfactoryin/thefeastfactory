import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BookingStatus,
  OrderStatus,
  PaymentSource,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  PaymentsService,
  type RazorpayWebhookPayload,
} from '../src/modules/payments/payments.service';

const baseRefund = {
  id: 'refund-1',
  paymentId: 'payment-1',
  amount: new Prisma.Decimal('499.00'),
  refundStatus: RefundStatus.SUCCESS,
  razorpayRefundId: 'local-refund-1',
  reason: 'Customer request',
  initiatedById: 'admin-1',
  gatewayResponse: null,
  initiatedAt: new Date(),
  processedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function service(prisma: object, generated: string[] = []) {
  return new PaymentsService(
    {
      checkoutAttempt: { findUnique: async () => null },
      ...prisma,
    } as never,
    { get: () => undefined } as never,
    {
      generateBookingDocuments: async (id: string) => generated.push(id),
    } as never,
  );
}

function configuredService(prisma: object, generated: string[] = []) {
  return new PaymentsService(
    prisma as never,
    {
      get: (key: string, fallback?: string) =>
        ({
          RAZORPAY_KEY_ID: 'rzp_live_current',
          RAZORPAY_KEY_SECRET: 'current-secret',
          RAZORPAY_CURRENCY: 'INR',
        })[key] ?? fallback,
    } as never,
    {
      generateBookingDocuments: async (id: string) => generated.push(id),
    } as never,
  );
}

test('Razorpay currency prefers the managed database setting', async () => {
  const payments = new PaymentsService(
    {
      platformSetting: {
        findUnique: async () => ({ value: 'AED' }),
      },
    } as never,
    { get: (_key: string, fallback: string) => fallback } as never,
    {} as never,
  );
  const managedCurrency = payments as unknown as {
    currency(): Promise<string>;
  };
  assert.equal(await managedCurrency.currency(), 'AED');
});

test('booking gateway orders reject amounts below one rupee', async () => {
  const payments = service({
    booking: {
      findFirst: async () => ({
        id: 'booking-1',
        bookingNumber: 'TFF-B-1',
        status: BookingStatus.CONFIRMED,
        totalAmount: new Prisma.Decimal('0.50'),
        orders: [{ id: 'order-1', totalAmount: new Prisma.Decimal('0.50') }],
        payments: [],
      }),
    },
    platformSetting: { findUnique: async () => null },
  });

  await assert.rejects(
    payments.createBookingGatewayOrder('user-1', 'booking-1'),
    BadRequestException,
  );
});

test('customer can create a partial booking payment after kitchen approval', async () => {
  let createdAmount = '';
  const payments = service({
    booking: {
      findFirst: async () => ({
        id: 'booking-1',
        bookingNumber: 'TFF-B-1',
        status: BookingStatus.CONFIRMED,
        totalAmount: new Prisma.Decimal('1000.00'),
        orders: [
          { id: 'order-1', totalAmount: new Prisma.Decimal('1000.00') },
        ],
        payments: [
          {
            amount: new Prisma.Decimal('200.00'),
            paymentStatus: PaymentStatus.PAID,
            refunds: [],
            allocations: [
              { orderId: 'order-1', amount: new Prisma.Decimal('200.00') },
            ],
          },
        ],
      }),
    },
    platformSetting: { findUnique: async () => null },
    payment: {
      create: async ({ data }: { data: { amount: Prisma.Decimal } }) => {
        createdAmount = data.amount.toFixed(2);
        return { id: 'payment-partial', ...data };
      },
    },
  });

  const result = await payments.createBookingGatewayOrder(
    'user-1',
    'booking-1',
    250,
  );
  assert.equal(createdAmount, '250.00');
  assert.equal(result.amount, 25000);
});

test('customer partial booking payment cannot exceed the remaining balance', async () => {
  const payments = service({
    booking: {
      findFirst: async () => ({
        id: 'booking-1',
        bookingNumber: 'TFF-B-1',
        status: BookingStatus.CONFIRMED,
        totalAmount: new Prisma.Decimal('1000.00'),
        orders: [
          { id: 'order-1', totalAmount: new Prisma.Decimal('1000.00') },
        ],
        payments: [
          {
            amount: new Prisma.Decimal('800.00'),
            paymentStatus: PaymentStatus.PAID,
            refunds: [],
            allocations: [
              { orderId: 'order-1', amount: new Prisma.Decimal('800.00') },
            ],
          },
        ],
      }),
    },
  });

  await assert.rejects(
    payments.createBookingGatewayOrder('user-1', 'booking-1', 250),
    /remaining balance of ₹200.00/,
  );
});

test('a pending gateway order is reused only after provider validation', async () => {
  let fetchedId = '';
  const payments = configuredService({
    booking: {
      findFirst: async () => ({
        id: 'booking-1',
        bookingNumber: 'TFF-B-1',
        status: BookingStatus.CONFIRMED,
        totalAmount: new Prisma.Decimal('1000.00'),
        orders: [
          { id: 'order-1', totalAmount: new Prisma.Decimal('1000.00') },
        ],
        payments: [
          {
            id: 'payment-1',
            amount: new Prisma.Decimal('1000.00'),
            paymentStatus: PaymentStatus.PENDING,
            razorpayOrderId: 'gateway-current',
            refunds: [],
            allocations: [],
          },
        ],
      }),
    },
    platformSetting: { findUnique: async () => null },
  });
  (payments as unknown as { client: () => object }).client = () => ({
    orders: {
      fetch: async (id: string) => {
        fetchedId = id;
        return {
          id,
          amount: 100000,
          amount_due: 100000,
          amount_paid: 0,
          currency: 'INR',
          status: 'created',
        };
      },
    },
  });

  const result = await payments.createBookingGatewayOrder(
    'user-1',
    'booking-1',
  );
  assert.equal(fetchedId, 'gateway-current');
  assert.equal(result.id, 'gateway-current');
  assert.equal(result.reused, true);
});

test('a gateway order from previous credentials is retired and replaced', async () => {
  let retiredId = '';
  let createdPaymentOrderId = '';
  const payments = configuredService({
    booking: {
      findFirst: async () => ({
        id: 'booking-1',
        bookingNumber: 'TFF-B-1',
        status: BookingStatus.CONFIRMED,
        totalAmount: new Prisma.Decimal('1000.00'),
        orders: [
          { id: 'order-1', totalAmount: new Prisma.Decimal('1000.00') },
        ],
        payments: [
          {
            id: 'payment-old',
            amount: new Prisma.Decimal('1000.00'),
            paymentStatus: PaymentStatus.PENDING,
            razorpayOrderId: 'gateway-previous-account',
            refunds: [],
            allocations: [],
          },
        ],
      }),
    },
    payment: {
      updateMany: async ({ where }: { where: { razorpayOrderId: string } }) => {
        retiredId = where.razorpayOrderId;
        return { count: 1 };
      },
      create: async ({ data }: { data: { razorpayOrderId: string } }) => {
        createdPaymentOrderId = data.razorpayOrderId;
        return { id: 'payment-new' };
      },
    },
    platformSetting: { findUnique: async () => null },
  });
  (payments as unknown as { client: () => object }).client = () => ({
    orders: {
      fetch: async () => {
        throw {
          statusCode: 400,
          error: { description: 'The id provided does not exist' },
        };
      },
      create: async () => ({
        id: 'gateway-current-account',
        amount: 100000,
        currency: 'INR',
      }),
    },
  });

  const result = await payments.createBookingGatewayOrder(
    'user-1',
    'booking-1',
  );
  assert.equal(retiredId, 'gateway-previous-account');
  assert.equal(createdPaymentOrderId, 'gateway-current-account');
  assert.equal(result.id, 'gateway-current-account');
  assert.equal(result.reused, false);
});

test('full refund is idempotent when a non-failed refund already exists', async () => {
  let createCalls = 0;
  const payments = service({
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback({
        $queryRaw: async () => [{ id: 'payment-1' }],
        payment: {
          findUnique: async () => ({
            id: 'payment-1',
            amount: new Prisma.Decimal('499.00'),
            paymentStatus: PaymentStatus.REFUNDED,
            refunds: [baseRefund],
            booking: {
              id: 'booking-1',
              status: BookingStatus.DECLINED,
              regionId: 'region-1',
            },
          }),
        },
        refund: {
          create: async () => {
            createCalls += 1;
          },
        },
      }),
  });

  const result = await payments.createRefund('admin-1', 'payment-1', 'Retry');
  assert.equal(result.id, 'refund-1');
  assert.equal(result.amount, '499.00');
  assert.equal(createCalls, 0);
});

test('concurrent refund requests submit only one gateway refund', async () => {
  let refundRecord: typeof baseRefund | undefined;
  let gatewayCalls = 0;
  let transactionTail = Promise.resolve();
  const generated: string[] = [];
  const payment = {
    id: 'payment-1',
    bookingId: 'booking-1',
    amount: new Prisma.Decimal('499.00'),
    paymentStatus: PaymentStatus.PAID,
    razorpayPaymentId: 'pay-split-1',
    refunds: [] as (typeof baseRefund)[],
    booking: {
      id: 'booking-1',
      status: BookingStatus.DECLINED,
      regionId: 'region-1',
      totalAmount: new Prisma.Decimal('499.00'),
    },
  };
  const tx = {
    $queryRaw: async () => [{ id: payment.id }],
    payment: {
      findUnique: async () => ({
        ...payment,
        refunds: refundRecord ? [refundRecord] : [],
      }),
      update: async () => undefined,
      findMany: async () => [
        {
          amount: payment.amount,
          paymentStatus: PaymentStatus.REFUNDED,
          refunds: refundRecord ? [refundRecord] : [],
        },
      ],
    },
    refund: {
      create: async ({ data }: { data: Partial<typeof baseRefund> }) => {
        refundRecord = {
          ...baseRefund,
          ...data,
          id: 'refund-concurrent',
          refundStatus: RefundStatus.PROCESSING,
          updatedAt: new Date(),
        };
        return refundRecord;
      },
      update: async ({ data }: { data: Partial<typeof baseRefund> }) => {
        refundRecord = { ...refundRecord!, ...data, updatedAt: new Date() };
        return refundRecord;
      },
    },
    order: { update: async () => undefined },
  };
  const prisma = {
    $transaction: async (
      callback: (transaction: typeof tx) => Promise<unknown>,
    ) => {
      const previous = transactionTail;
      let release = () => undefined;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback(tx);
      } finally {
        release();
      }
    },
    payment: {
      findUnique: async () => ({
        ...payment,
        refunds: refundRecord ? [refundRecord] : [],
      }),
    },
    refund: {
      update: tx.refund.update,
    },
  };
  const payments = configuredService(prisma, generated);
  (payments as unknown as { reconcileRefund: () => Promise<void> }).reconcileRefund =
    async () => undefined;
  (payments as unknown as { client: () => object }).client = () => ({
    payments: {
      refund: async () => {
        gatewayCalls += 1;
        return {
          id: 'rfnd_gateway_1',
          payment_id: payment.razorpayPaymentId,
          amount: 49900,
          status: 'processed',
          receipt: 'tff_payment-1',
        };
      },
      fetchMultipleRefund: async () => ({ items: [] }),
    },
  });

  const results = await Promise.all([
    payments.createRefund('operations-1', payment.id, 'Declined'),
    payments.createRefund('operations-1', payment.id, 'Duplicate click'),
  ]);

  assert.equal(gatewayCalls, 1);
  assert.equal(results[0].id, 'refund-concurrent');
  assert.equal(results[1].id, 'refund-concurrent');
  assert.equal(refundRecord?.refundStatus, RefundStatus.SUCCESS);
  assert.deepEqual(generated, []);
});

test('retry after an uncertain refund response reconciles the gateway before resubmitting', async () => {
  let gatewaySubmitCalls = 0;
  let refundRecord = {
    ...baseRefund,
    refundStatus: RefundStatus.FAILED,
    razorpayRefundId: null,
  };
  const payment = {
    id: 'payment-1',
    bookingId: 'booking-1',
    amount: new Prisma.Decimal('499.00'),
    paymentStatus: PaymentStatus.PAID,
    razorpayPaymentId: 'pay-split-1',
    booking: {
      id: 'booking-1',
      status: BookingStatus.DECLINED,
      regionId: 'region-1',
      totalAmount: new Prisma.Decimal('499.00'),
    },
  };
  const tx = {
    $queryRaw: async () => [{ id: payment.id }],
    payment: {
      findUnique: async () => ({ ...payment, refunds: [refundRecord] }),
      update: async () => undefined,
      findMany: async () => [
        {
          amount: payment.amount,
          paymentStatus: PaymentStatus.REFUNDED,
          refunds: [refundRecord],
        },
      ],
    },
    refund: {
      update: async ({ data }: { data: Partial<typeof baseRefund> }) => {
        refundRecord = { ...refundRecord, ...data, updatedAt: new Date() };
        return refundRecord;
      },
    },
    order: { update: async () => undefined },
  };
  const prisma = {
    $transaction: async (
      callback: (transaction: typeof tx) => Promise<unknown>,
    ) => callback(tx),
    payment: {
      findUnique: async () => ({ ...payment, refunds: [refundRecord] }),
    },
    refund: { update: tx.refund.update },
  };
  const payments = configuredService(prisma);
  (payments as unknown as { reconcileRefund: () => Promise<void> }).reconcileRefund =
    async () => undefined;
  (payments as unknown as { client: () => object }).client = () => ({
    payments: {
      fetchMultipleRefund: async () => ({
        items: [
          {
            id: 'rfnd_already_created',
            payment_id: payment.razorpayPaymentId,
            amount: 49900,
            status: 'processed',
            receipt: 'tff_payment-1',
          },
        ],
      }),
      refund: async () => {
        gatewaySubmitCalls += 1;
        throw new Error('must not submit a duplicate refund');
      },
    },
  });

  const result = await payments.createRefund(
    'operations-1',
    payment.id,
    'Retry after timeout',
  );

  assert.equal(gatewaySubmitCalls, 0);
  assert.equal(result.razorpayRefundId, 'rfnd_already_created');
  assert.equal(result.refundStatus, RefundStatus.SUCCESS);
});

test('manual refunds are recorded once for declined booking deposits', async () => {
  let createdRefund: Record<string, unknown> | undefined;
  const reconciled: string[] = [];
  const payments = service({
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback({
        $queryRaw: async () => [{ id: 'manual-payment-1' }],
        payment: {
          findFirst: async () => ({
            id: 'manual-payment-1',
            bookingId: 'booking-1',
            amount: new Prisma.Decimal('500.00'),
            paymentStatus: PaymentStatus.PAID,
            source: PaymentSource.MANUAL,
            refunds: [],
            booking: { status: BookingStatus.DECLINED },
          }),
        },
        refund: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdRefund = data;
            return {
              ...baseRefund,
              id: 'manual-refund-1',
              amount: data.amount as Prisma.Decimal,
              refundStatus: RefundStatus.SUCCESS,
            };
          },
        },
      }),
  });
  const internal = payments as unknown as {
    reconcileRefund(paymentId: string): Promise<void>;
  };
  internal.reconcileRefund = async (paymentId: string) => {
    reconciled.push(paymentId);
  };

  const result = await payments.recordManualRefund(
    'operations-1',
    'booking-1',
    'manual-payment-1',
    'Refunded by UPI',
  );

  assert.equal(createdRefund?.refundStatus, RefundStatus.SUCCESS);
  assert.equal(createdRefund?.reason, 'Refunded by UPI');
  assert.equal(result.amount, '500.00');
  assert.deepEqual(reconciled, ['manual-payment-1']);
});

test('local full refund uses the complete paid amount and reconciles the booking ledger', async () => {
  let createdAmount = '';
  const reconciled: string[] = [];
  const payment = {
    id: 'payment-1',
    bookingId: 'booking-1',
    amount: new Prisma.Decimal('699.00'),
    paymentStatus: PaymentStatus.PAID,
    razorpayPaymentId: 'pay-local',
    refunds: [] as (typeof baseRefund)[],
    booking: {
      id: 'booking-1',
      status: BookingStatus.DECLINED,
      regionId: 'region-1',
      totalAmount: new Prisma.Decimal('699.00'),
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        $queryRaw: async () => [{ id: 'payment-1' }],
        payment: {
          findUnique: async () => payment,
        },
        refund: {
          create: async ({ data }: { data: { amount: Prisma.Decimal } }) => {
            createdAmount = data.amount.toFixed(2);
            return { ...baseRefund, amount: data.amount };
          },
        },
      }),
  };

  const payments = service(prisma);
  (payments as unknown as { reconcileRefund: (id: string) => Promise<void> }).reconcileRefund =
    async (id: string) => {
      reconciled.push(id);
    };
  const result = await payments.createRefund(
    'admin-1',
    'payment-1',
    'Customer request',
  );
  assert.equal(createdAmount, '699.00');
  assert.equal(result.amount, '699.00');
  assert.deepEqual(reconciled, ['payment-1']);
});

test('refunds reject captured payments for bookings that were not declined', async () => {
  const payments = service({
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback({
        $queryRaw: async () => [{ id: 'payment-1' }],
        payment: {
          findUnique: async () => ({
            id: 'payment-1',
            bookingId: 'booking-1',
            amount: new Prisma.Decimal('699.00'),
            paymentStatus: PaymentStatus.PAID,
            razorpayPaymentId: 'pay-confirmed',
            refunds: [],
            booking: {
              id: 'booking-1',
              status: BookingStatus.CONFIRMED,
              regionId: 'region-1',
            },
          }),
        },
      }),
  });

  await assert.rejects(
    payments.createRefund('operations-1', 'payment-1', 'Not eligible'),
    /Only payments for declined bookings can be refunded/,
  );
});

test('refunding one duplicate charge keeps the booking paid while another charge remains', async () => {
  let bookingStatus: PaymentStatus | undefined;
  let orderStatus: PaymentStatus | undefined;
  const payments = service({
    payment: {
      findUnique: async () => ({
        id: 'payment-1',
        bookingId: 'booking-1',
        amount: new Prisma.Decimal('699.00'),
        refunds: [{ ...baseRefund, amount: new Prisma.Decimal('699.00') }],
      }),
    },
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        payment: {
          update: async () => undefined,
        },
        booking: {
          findUnique: async () => ({
            id: 'booking-1',
            totalAmount: new Prisma.Decimal('699.00'),
            orders: [
              { id: 'order-1', totalAmount: new Prisma.Decimal('699.00') },
            ],
            payments: [
              {
                amount: new Prisma.Decimal('699.00'),
                paymentStatus: PaymentStatus.REFUNDED,
                refunds: [
                  { ...baseRefund, amount: new Prisma.Decimal('699.00') },
                ],
                allocations: [
                  { orderId: 'order-1', amount: new Prisma.Decimal('699.00') },
                ],
              },
              {
                amount: new Prisma.Decimal('699.00'),
                paymentStatus: PaymentStatus.PAID,
                refunds: [],
                allocations: [
                  { orderId: 'order-1', amount: new Prisma.Decimal('699.00') },
                ],
              },
            ],
          }),
          update: async ({
            data,
          }: {
            data: { paymentStatus: PaymentStatus };
          }) => {
            bookingStatus = data.paymentStatus;
          },
        },
        order: {
          update: async ({
            data,
          }: {
            data: { paymentStatus: PaymentStatus };
          }) => {
            orderStatus = data.paymentStatus;
          },
        },
      }),
  });
  const internal = payments as unknown as {
    reconcileRefund(paymentId: string): Promise<void>;
  };

  await internal.reconcileRefund('payment-1');
  assert.equal(bookingStatus, PaymentStatus.PAID);
  assert.equal(orderStatus, PaymentStatus.PAID);
});

test('production payments fail closed when Razorpay is not configured', async () => {
  const payments = new PaymentsService(
    {} as never,
    {
      get: (key: string) => (key === 'NODE_ENV' ? 'production' : undefined),
    } as never,
    {} as never,
  );

  await assert.rejects(
    payments.createBookingGatewayOrder('user-1', 'booking-1'),
    ServiceUnavailableException,
  );
  await assert.rejects(
    payments.verify('user-1', {
      razorpayOrderId: 'gateway-1',
      razorpayPaymentId: 'payment-1',
      razorpaySignature: 'local_success',
    }),
    ServiceUnavailableException,
  );
});

test('only one concurrent payment handler can claim confirmation', async () => {
  const generated: string[] = [];
  let orderUpdates = 0;
  const payments = service(
    {
      payment: {
        findUnique: async () => ({
          id: 'payment-1',
          orderId: 'order-1',
          paymentStatus: PaymentStatus.PENDING,
          order: { orderStatus: OrderStatus.PENDING_PAYMENT },
        }),
      },
      $transaction: async (callback: (tx: object) => Promise<boolean>) =>
        callback({
          payment: {
            updateMany: async () => ({ count: 0 }),
          },
          order: {
            update: async () => {
              orderUpdates += 1;
            },
          },
        }),
    },
    generated,
  );
  const internal = payments as unknown as {
    markPaid(
      paymentId: string,
      gatewayPaymentId: string,
      signature: string | undefined,
      gateway: { id: string; amount: number; status: string },
    ): Promise<void>;
  };

  await internal.markPaid('payment-1', 'gateway-payment-1', undefined, {
    id: 'gateway-payment-1',
    amount: 10000,
    status: 'captured',
  });
  assert.equal(orderUpdates, 0);
  assert.deepEqual(generated, []);
});

test('an unprocessed duplicate webhook is retried instead of discarded', async () => {
  let eventUpdate: Record<string, unknown> | undefined;
  const payments = service({
    paymentWebhookEvent: {
      create: async () => {
        throw { code: 'P2002' };
      },
      findUnique: async () => ({
        providerEventId: 'event-1',
        processedAt: null,
        processingError: 'temporary database failure',
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        eventUpdate = data;
      },
    },
    payment: {
      findMany: async () => [],
    },
  });

  const result = await payments.webhook(
    Buffer.from('captured-event'),
    {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'gateway-payment-1',
            order_id: 'gateway-order-1',
            amount: 10000,
            status: 'captured',
          },
        },
      },
    },
    undefined,
    'event-1',
  );

  assert.deepEqual(result, { received: true, retried: true });
  assert.ok(eventUpdate?.processedAt instanceof Date);
  assert.equal(eventUpdate?.processingError, null);
});

test('a captured webhook cannot confirm an underpaid batch', async () => {
  const payments = service({
    payment: {
      findMany: async () => [
        { id: 'payment-1', amount: new Prisma.Decimal('1000.00') },
        { id: 'payment-2', amount: new Prisma.Decimal('750.00') },
      ],
    },
  });
  const internal = payments as unknown as {
    processWebhook(
      eventType: string,
      payload: {
        payload: {
          payment: {
            entity: {
              id: string;
              order_id: string;
              amount: number;
              status: string;
            };
          };
        };
      },
    ): Promise<void>;
  };

  await assert.rejects(
    internal.processWebhook('payment.captured', {
      payload: {
        payment: {
          entity: {
            id: 'gateway-payment-1',
            order_id: 'gateway-order-1',
            amount: 100000,
            status: 'captured',
          },
        },
      },
    }),
    /could not be reconciled/,
  );
});

test('a stale failure webhook cannot overwrite a concurrently paid ledger', async () => {
  let orderUpdates = 0;
  const payments = service({
    payment: {
      findMany: async () => [
        {
          id: 'payment-1',
          orderId: 'order-1',
          paymentStatus: PaymentStatus.PENDING,
          order: { id: 'order-1' },
        },
      ],
    },
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        payment: {
          updateMany: async () => ({ count: 0 }),
          count: async () => 0,
        },
        order: {
          updateMany: async () => {
            orderUpdates += 1;
          },
        },
      }),
  });
  const internal = payments as unknown as {
    processWebhook(
      eventType: string,
      payload: {
        payload: {
          payment: {
            entity: {
              id: string;
              order_id: string;
              amount: number;
              status: string;
            };
          };
        };
      },
    ): Promise<void>;
  };

  await internal.processWebhook('payment.failed', {
    payload: {
      payment: {
        entity: {
          id: 'gateway-payment-1',
          order_id: 'gateway-order-1',
          amount: 69900,
          status: 'failed',
        },
      },
    },
  });
  assert.equal(orderUpdates, 0);
});

test('a failed booking balance payment resynchronizes every child ledger', async () => {
  const orderStatuses = new Map<string, PaymentStatus>();
  let bookingStatus: PaymentStatus | undefined;
  const payments = service({
    payment: {
      findMany: async () => [
        {
          id: 'failed-payment',
          orderId: 'order-1',
          bookingId: 'booking-1',
          paymentStatus: PaymentStatus.PENDING,
          order: {
            id: 'order-1',
            totalAmount: new Prisma.Decimal('400.00'),
          },
        },
      ],
    },
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        payment: {
          updateMany: async () => ({ count: 1 }),
        },
        booking: {
          findUnique: async () => ({
            id: 'booking-1',
            totalAmount: new Prisma.Decimal('1000.00'),
            orders: [
              { id: 'order-1', totalAmount: new Prisma.Decimal('400.00') },
              { id: 'order-2', totalAmount: new Prisma.Decimal('600.00') },
            ],
            payments: [
              {
                amount: new Prisma.Decimal('500.00'),
                paymentStatus: PaymentStatus.PAID,
                refunds: [],
                allocations: [
                  {
                    orderId: 'order-1',
                    amount: new Prisma.Decimal('200.00'),
                  },
                  {
                    orderId: 'order-2',
                    amount: new Prisma.Decimal('300.00'),
                  },
                ],
              },
            ],
          }),
          update: async ({
            data,
          }: {
            data: { paymentStatus: PaymentStatus };
          }) => {
            bookingStatus = data.paymentStatus;
          },
        },
        order: {
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { paymentStatus: PaymentStatus };
          }) => {
            orderStatuses.set(where.id, data.paymentStatus);
          },
        },
      }),
  });
  const internal = payments as unknown as {
    processWebhook(
      eventType: string,
      payload: RazorpayWebhookPayload,
    ): Promise<void>;
  };

  await internal.processWebhook('payment.failed', {
    payload: {
      payment: {
        entity: {
          id: 'gateway-payment-failed',
          order_id: 'gateway-order-1',
          amount: 50000,
          status: 'failed',
        },
      },
    },
  });

  assert.equal(bookingStatus, PaymentStatus.PARTIALLY_PAID);
  assert.deepEqual(Object.fromEntries(orderStatuses), {
    'order-1': PaymentStatus.PARTIALLY_PAID,
    'order-2': PaymentStatus.PARTIALLY_PAID,
  });
});

test('a late captured payment cannot resurrect a cancelled booking', async () => {
  let bookingData: Record<string, unknown> | undefined;
  let orderData: Record<string, unknown> | undefined;
  const payments = service({
    payment: {
      findUnique: async () => ({
        id: 'payment-1',
        bookingId: 'booking-1',
        amount: new Prisma.Decimal('100.00'),
        paymentStatus: PaymentStatus.PENDING,
      }),
    },
    $transaction: async (callback: (tx: object) => Promise<boolean>) =>
      callback({
        payment: {
          updateMany: async () => ({ count: 1 }),
        },
        booking: {
          findUnique: async () => ({
            id: 'booking-1',
            status: BookingStatus.CANCELLED,
            totalAmount: new Prisma.Decimal('100.00'),
            orders: [
              { id: 'order-1', totalAmount: new Prisma.Decimal('100.00') },
            ],
            payments: [
              {
                amount: new Prisma.Decimal('100.00'),
                paymentStatus: PaymentStatus.PAID,
                refunds: [],
                allocations: [
                  { orderId: 'order-1', amount: new Prisma.Decimal('100.00') },
                ],
              },
            ],
          }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            bookingData = data;
          },
        },
        order: {
          update: async ({ data }: { data: Record<string, unknown> }) => {
            orderData = data;
          },
        },
      }),
  });
  const internal = payments as unknown as {
    markPaid(
      paymentId: string,
      gatewayPaymentId: string,
      signature: string | undefined,
      gateway: { id: string; amount: number; status: string },
    ): Promise<void>;
  };

  await internal.markPaid('payment-1', 'gateway-payment-1', undefined, {
    id: 'gateway-payment-1',
    amount: 10000,
    status: 'captured',
  });
  assert.equal(bookingData?.paymentStatus, PaymentStatus.PAID);
  assert.equal(bookingData?.status, undefined);
  assert.equal(orderData?.paymentStatus, PaymentStatus.PAID);
  assert.equal(orderData?.orderStatus, undefined);
  assert.equal(orderData?.statusHistory, undefined);
});
