import assert from 'node:assert/strict';
import test from 'node:test';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
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
