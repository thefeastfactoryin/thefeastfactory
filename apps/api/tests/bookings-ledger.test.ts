import assert from 'node:assert/strict';
import test from 'node:test';
import { PaymentStatus, Prisma } from '@prisma/client';
import { BookingsService } from '../src/modules/bookings/bookings.service';

test('booking child balances use allocations across multiple deposits', () => {
  const service = new BookingsService(
    {} as never,
    {
      serializeOrder: (order: { id: string; totalAmount: Prisma.Decimal }) => ({
        id: order.id,
        totalAmount: order.totalAmount.toFixed(2),
      }),
    } as never,
    {} as never,
  );
  const payments = [
    {
      id: 'payment-1',
      razorpaySignature: 'must-not-leak',
      gatewayResponse: { internal: true },
      amount: new Prisma.Decimal('5485.00'),
      paymentStatus: PaymentStatus.PAID,
      allocations: [
        {
          id: 'allocation-1',
          paymentId: 'payment-1',
          orderId: 'order-1',
          amount: new Prisma.Decimal('990.00'),
          createdAt: new Date(),
        },
        {
          id: 'allocation-2',
          paymentId: 'payment-1',
          orderId: 'order-2',
          amount: new Prisma.Decimal('4495.00'),
          createdAt: new Date(),
        },
      ],
      refunds: [],
    },
    {
      id: 'payment-2',
      amount: new Prisma.Decimal('5485.00'),
      paymentStatus: PaymentStatus.PAID,
      allocations: [
        {
          id: 'allocation-3',
          paymentId: 'payment-2',
          orderId: 'order-2',
          amount: new Prisma.Decimal('5485.00'),
          createdAt: new Date(),
        },
      ],
      refunds: [],
    },
  ];
  const booking = {
    totalAmount: new Prisma.Decimal('10970.00'),
    itemsSubtotal: new Prisma.Decimal('10970.00'),
    cutleryTotal: new Prisma.Decimal(0),
    deliveryFee: new Prisma.Decimal(0),
    distanceKm: new Prisma.Decimal(0),
    latitude: new Prisma.Decimal('17.385'),
    longitude: new Prisma.Decimal('78.4867'),
    eventTimeStart: new Date('1970-01-01T12:30:00.000Z'),
    payments,
    region: null,
    cutleryItems: [],
    orders: [
      { id: 'order-1', totalAmount: new Prisma.Decimal('990.00') },
      { id: 'order-2', totalAmount: new Prisma.Decimal('9980.00') },
    ],
  };

  const result = service.serialize(booking as never);

  assert.equal(result.amountPaid, '10970.00');
  assert.equal(result.balanceDue, '0.00');
  assert.equal('razorpaySignature' in result.payments[0], false);
  assert.equal('gatewayResponse' in result.payments[0], false);
  assert.deepEqual(
    result.orders.map((order) => ({
      id: order.id,
      amountPaid: order.amountPaid,
      balanceDue: order.balanceDue,
    })),
    [
      { id: 'order-1', amountPaid: '990.00', balanceDue: '0.00' },
      { id: 'order-2', amountPaid: '9980.00', balanceDue: '0.00' },
    ],
  );
});
