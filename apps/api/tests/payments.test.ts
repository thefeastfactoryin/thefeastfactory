import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
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
