import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentsService } from '../src/modules/payments/payments.service';

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
    prisma as never,
    { get: () => undefined } as never,
    {
      generateOrderDocuments: async (id: string) => generated.push(id),
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

test('gateway orders reject amounts below one rupee', async () => {
  const payments = service({
    order: {
      findFirst: async () => ({
        id: 'order-1',
        orderNumber: 'TFF-1',
        orderStatus: OrderStatus.PENDING_PAYMENT,
        totalAmount: new Prisma.Decimal('0.50'),
        payments: [],
      }),
    },
    platformSetting: { findUnique: async () => null },
  });

  await assert.rejects(
    payments.createGatewayOrder('user-1', 'order-1'),
    BadRequestException,
  );
});

test('batch checkout creates one gateway charge with one payment ledger per order', async () => {
  let createdRows: Array<{ orderId: string; amount: Prisma.Decimal }> = [];
  const payments = service({
    order: {
      findMany: async () => [
        {
          id: '11111111-1111-4111-8111-111111111111',
          orderNumber: 'TFF-1',
          orderStatus: OrderStatus.PENDING_PAYMENT,
          totalAmount: new Prisma.Decimal('1000.00'),
          payments: [],
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          orderNumber: 'TFF-2',
          orderStatus: OrderStatus.PENDING_PAYMENT,
          totalAmount: new Prisma.Decimal('750.00'),
          payments: [],
        },
      ],
    },
    platformSetting: { findUnique: async () => null },
    payment: {
      createMany: async ({ data }: { data: typeof createdRows }) => {
        createdRows = data;
        return { count: data.length };
      },
    },
  });

  const result = await payments.createBatchGatewayOrder('user-1', [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ]);

  assert.equal(result.amount, 175000);
  assert.equal(result.localMode, true);
  assert.equal(createdRows.length, 2);
  assert.deepEqual(
    createdRows.map((row) => row.amount.toFixed(2)),
    ['1000.00', '750.00'],
  );
});

test('payment batch summary returns the combined amount for retry screens', async () => {
  const payments = service({
    payment: {
      findFirst: async () => ({
        id: 'payment-1',
        orderId: 'order-1',
        amount: new Prisma.Decimal('1000.00'),
        razorpayOrderId: 'gateway-batch-1',
      }),
      findMany: async () => [
        {
          orderId: 'order-1',
          amount: new Prisma.Decimal('1000.00'),
        },
        {
          orderId: 'order-2',
          amount: new Prisma.Decimal('750.00'),
        },
      ],
    },
  });

  assert.deepEqual(
    await payments.getPaymentBatchSummary('user-1', 'order-1'),
    {
      orderCount: 2,
      orderIds: ['order-1', 'order-2'],
      totalAmount: '1750.00',
    },
  );
});

test('checkout batch is recoverable before a gateway payment exists', async () => {
  const payments = service({
    payment: {
      findFirst: async () => null,
    },
    order: {
      findFirst: async () => ({
        id: 'order-1',
        totalAmount: new Prisma.Decimal('1000.00'),
        checkoutBatchId: '11111111-1111-4111-8111-111111111111',
      }),
      findMany: async () => [
        { id: 'order-1', totalAmount: new Prisma.Decimal('1000.00') },
        { id: 'order-2', totalAmount: new Prisma.Decimal('750.00') },
      ],
    },
  });

  assert.deepEqual(
    await payments.getPaymentBatchSummary('user-1', 'order-1'),
    {
      orderCount: 2,
      orderIds: ['order-1', 'order-2'],
      totalAmount: '1750.00',
    },
  );
});

test('full refund is idempotent when a non-failed refund already exists', async () => {
  let createCalls = 0;
  const payments = service({
    payment: {
      findUnique: async () => ({
        id: 'payment-1',
        amount: new Prisma.Decimal('499.00'),
        paymentStatus: PaymentStatus.REFUNDED,
        refunds: [baseRefund],
        order: { id: 'order-1' },
      }),
    },
    refund: {
      create: async () => {
        createCalls += 1;
      },
    },
  });

  const result = await payments.createRefund('admin-1', 'payment-1', 'Retry');
  assert.equal(result.id, 'refund-1');
  assert.equal(result.amount, '499.00');
  assert.equal(createCalls, 0);
});

test('local full refund always uses the complete paid amount and reconciles both ledgers', async () => {
  const generated: string[] = [];
  const updates: Array<{ target: string; status: PaymentStatus }> = [];
  let findCalls = 0;
  let createdAmount = '';
  const payment = {
    id: 'payment-1',
    orderId: 'order-1',
    amount: new Prisma.Decimal('699.00'),
    paymentStatus: PaymentStatus.PAID,
    razorpayPaymentId: 'pay-local',
    refunds: [] as (typeof baseRefund)[],
    order: { id: 'order-1' },
  };
  const prisma = {
    payment: {
      findUnique: async () => {
        findCalls += 1;
        return findCalls === 1
          ? payment
          : {
              ...payment,
              refunds: [
                baseRefund,
                { ...baseRefund, amount: new Prisma.Decimal('200.00') },
              ],
            };
      },
    },
    refund: {
      create: async ({ data }: { data: { amount: Prisma.Decimal } }) => {
        createdAmount = data.amount.toFixed(2);
        return { ...baseRefund, amount: data.amount };
      },
    },
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        payment: {
          update: async ({
            data,
          }: {
            data: { paymentStatus: PaymentStatus };
          }) => updates.push({ target: 'payment', status: data.paymentStatus }),
          count: async () => 0,
        },
        order: {
          update: async ({
            data,
          }: {
            data: { paymentStatus: PaymentStatus };
          }) => updates.push({ target: 'order', status: data.paymentStatus }),
        },
      }),
  };

  const result = await service(prisma, generated).createRefund(
    'admin-1',
    'payment-1',
    'Customer request',
  );
  assert.equal(createdAmount, '699.00');
  assert.equal(result.amount, '699.00');
  assert.deepEqual(updates, [
    { target: 'payment', status: PaymentStatus.REFUNDED },
    { target: 'order', status: PaymentStatus.REFUNDED },
  ]);
  assert.deepEqual(generated, ['order-1']);
});

test('refunding one duplicate charge keeps an order paid while another paid charge remains', async () => {
  let orderStatus: PaymentStatus | undefined;
  const payments = service({
    payment: {
      findUnique: async () => ({
        id: 'payment-1',
        orderId: 'order-1',
        amount: new Prisma.Decimal('699.00'),
        refunds: [{ ...baseRefund, amount: new Prisma.Decimal('699.00') }],
        order: { id: 'order-1' },
      }),
    },
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        payment: {
          update: async () => undefined,
          count: async () => 1,
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
    payments.createGatewayOrder('user-1', 'order-1'),
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
      $transaction: async (
        callback: (tx: object) => Promise<boolean>,
      ) =>
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

test('a late captured payment cannot resurrect a cancelled order', async () => {
  let orderData: Record<string, unknown> | undefined;
  const payments = service({
    payment: {
      findUnique: async () => ({
        id: 'payment-1',
        orderId: 'order-1',
        paymentStatus: PaymentStatus.PENDING,
        order: { orderStatus: OrderStatus.CANCELLED },
      }),
    },
    $transaction: async (callback: (tx: object) => Promise<boolean>) =>
      callback({
        payment: {
          updateMany: async () => ({ count: 1 }),
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
  assert.equal(orderData?.paymentStatus, PaymentStatus.PAID);
  assert.equal(orderData?.orderStatus, undefined);
  assert.equal(orderData?.statusHistory, undefined);
});
