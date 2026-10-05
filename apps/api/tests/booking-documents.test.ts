import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DocumentType,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { OperationsService } from '../src/modules/operations/operations.service';

test('booking documents aggregate every package and create one receipt per payment', async () => {
  const created: Array<Record<string, unknown>> = [];
  const booking = {
    id: 'booking-1',
    bookingNumber: 'BKG-1001',
    userId: 'user-1',
    addressLine1: '1 Test Road',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    contactNumber: '9000000000',
    itemsSubtotal: new Prisma.Decimal('1000'),
    cutleryTotal: new Prisma.Decimal('50'),
    deliveryFee: new Prisma.Decimal('100'),
    totalAmount: new Prisma.Decimal('1150'),
    eventDate: new Date('2026-10-20'),
    createdAt: new Date('2026-10-05'),
    user: { name: 'Test Customer', email: 'test@example.com' },
    cutleryItems: [],
    orders: [
      {
        orderNumber: 'TFF-1',
        packageName: 'Package One',
        guestCount: 10,
        finalPerPlatePrice: new Prisma.Decimal('50'),
        totalAmount: new Prisma.Decimal('500'),
        selectedItems: [
          {
            menuItemName: 'Dish One',
            weightGrams: null,
            pricePerKg: null,
            lineTotal: null,
            categoryName: 'Mains',
            role: 'INCLUDED',
            itemPrice: new Prisma.Decimal('0'),
            adjustmentAmount: new Prisma.Decimal('0'),
          },
        ],
      },
      {
        orderNumber: 'TFF-2',
        packageName: 'Package Two',
        guestCount: 10,
        finalPerPlatePrice: new Prisma.Decimal('50'),
        totalAmount: new Prisma.Decimal('500'),
        selectedItems: [],
      },
    ],
    payments: [
      {
        id: 'payment-1',
        amount: new Prisma.Decimal('575'),
        paymentStatus: PaymentStatus.PAID,
        externalReference: 'UPI-1',
        razorpayPaymentId: null,
        paymentMethod: 'UPI',
        paidAt: new Date('2026-10-05'),
        refunds: [],
      },
      {
        id: 'payment-2',
        amount: new Prisma.Decimal('575'),
        paymentStatus: PaymentStatus.REFUNDED,
        externalReference: null,
        razorpayPaymentId: 'pay_2',
        paymentMethod: 'card',
        paidAt: new Date('2026-10-06'),
        refunds: [
          {
            id: 'refund-1',
            amount: new Prisma.Decimal('575'),
            refundStatus: RefundStatus.SUCCESS,
            reason: 'Declined',
            processedAt: new Date('2026-10-07'),
          },
        ],
      },
    ],
  };
  const operations = new OperationsService(
    {
      booking: {
        findUnique: async () => ({ userId: booking.userId }),
        findFirst: async () => booking,
      },
      platformSetting: {
        findMany: async () => [
          { key: 'business_gstin', value: '36ABCDE1234F1Z5' },
          { key: 'tax_sac_code', value: '9963' },
        ],
      },
      bookingDocument: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return data;
        },
      },
    } as never,
    {} as never,
    {} as never,
  );

  await operations.generateBookingDocuments(booking.id);

  assert.equal(
    created.filter(
      (document) => document.documentType === DocumentType.PAYMENT_RECEIPT,
    ).length,
    2,
  );
  assert.equal(
    created.filter(
      (document) => document.documentType === DocumentType.GST_INVOICE,
    ).length,
    1,
  );
  assert.equal(
    created.filter(
      (document) => document.documentType === DocumentType.REFUND_CREDIT_NOTE,
    ).length,
    1,
  );
  assert.ok(created.every((document) => document.bookingId === booking.id));
  const receipt = created.find(
    (document) => document.documentType === DocumentType.PAYMENT_RECEIPT,
  );
  const snapshot = receipt?.snapshot as {
    booking: { totalAmount: string; packages: unknown[]; payment: { amount: string } };
  };
  assert.equal(snapshot.booking.totalAmount, '1150.00');
  assert.equal(snapshot.booking.packages.length, 2);
  assert.equal(snapshot.booking.payment.amount, '575.00');
});
