import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminRole, PaymentStatus, Prisma } from '@prisma/client';
import { ReportsService } from '../src/modules/reports/reports.service';

test('revenue keeps fully refunded captures in gross before subtracting refunds', async () => {
  let paymentWhere: Record<string, unknown> | undefined;
  const reports = new ReportsService(
    {
      payment: {
        aggregate: async ({ where }: { where: Record<string, unknown> }) => {
          paymentWhere = where;
          return {
            _sum: { amount: new Prisma.Decimal('1000.00') },
            _count: 2,
          };
        },
      },
      refund: {
        aggregate: async () => ({
          _sum: { amount: new Prisma.Decimal('400.00') },
          _count: 1,
        }),
      },
    } as never,
    { resolveAdminScope: async () => undefined } as never,
  );

  const result = await reports.revenue(
    { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
  );

  assert.deepEqual(paymentWhere?.paymentStatus, {
    in: [PaymentStatus.PAID, PaymentStatus.REFUNDED],
  });
  assert.deepEqual(result, {
    grossRevenue: '1000',
    refundedAmount: '400',
    netRevenue: 600,
    paidPayments: 2,
  });
});
