import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CheckoutAttemptStatus,
  OrderStatus,
  PaymentPlan,
  PaymentStatus,
  PackageType,
  Prisma,
} from '@prisma/client';
import type { CheckoutSnapshot } from '../src/modules/cart/checkout-snapshot';
import { CartService } from '../src/modules/cart/cart.service';
import { cartFingerprint } from '../src/modules/cart/checkout-snapshot';
import { PaymentsService } from '../src/modules/payments/payments.service';

const snapshot: CheckoutSnapshot = {
  totalAmount: '1499.00',
  carts: [
    {
      cartId: 'cart-1',
      cartFingerprint: 'unchanged',
      addressId: 'address-1',
      regionId: 'region-1',
      eventName: null,
      eventDate: '2026-10-20T00:00:00.000Z',
      eventTimeStart: '1970-01-01T11:30:00.000Z',
      specialNotes: null,
      contactNumber: '9876543210',
      packageType: PackageType.FIXED_PACKAGE,
      packageName: 'Lunch',
      packageImageUrl: '/pkg-lunch.png',
      packageVersionNo: 1,
      guestCount: 10,
      basePerPlatePrice: '139.90',
      totalCustomizationCharges: '0.00',
      finalPerPlatePrice: '139.90',
      totalAmount: '1499.00',
      distanceKm: '5.00',
      deliveryFee: '100.00',
      deliveryServiceType: 'STANDARD',
      helperCount: 0,
      cutleryIncludedCount: 10,
      cutleryExtraCount: 0,
      cutleryUnitPrice: '5.00',
      cutleryTotal: '0.00',
      selectedItems: [],
    },
  ],
};

test('payment snapshot preserves fixed-package menu before any order exists', async () => {
  const cart = {
    id: 'cart-1',
    userId: 'user-1',
    status: 'ACTIVE',
    packageVersionId: 'version-1',
    packageVersion: {
      versionNo: 1,
      package: {
        type: PackageType.FIXED_PACKAGE,
        imageUrl: '/pkg-lunch.png',
      },
    },
    addressId: 'address-1',
    regionId: 'region-1',
    eventName: null,
    eventDate: new Date('2026-10-20T00:00:00.000Z'),
    eventTimeStart: new Date('1970-01-01T11:30:00.000Z'),
    guestCount: 10,
    deliveryServiceType: 'STANDARD',
    helperCount: 0,
    cutleryExtraCount: 0,
    contactNumber: '9876543210',
    specialNotes: null,
    items: [],
  };
  const prisma = {
    cart: { findMany: async () => [cart] },
    packageMenuItem: {
      findMany: async () => [
        {
          categoryId: 'category-1',
          menuItemId: 'menu-1',
          category: { name: 'Mains' },
          menuItem: {
            name: 'Paneer curry',
            isVeg: true,
            generalPrice: new Prisma.Decimal('99.00'),
          },
        },
      ],
    },
  };
  const carts = new CartService(
    prisma as never,
    { generateBookingDocuments: async () => undefined } as never,
    {} as never,
  );
  carts.quoteAll = async () =>
    ({
      valid: true,
      carts: [
        {
          cartId: cart.id,
          quote: {
            region: { id: 'region-1' },
            packageName: 'Lunch',
            packageType: PackageType.FIXED_PACKAGE,
            guestCount: 10,
            basePerPlatePrice: '139.90',
            totalCustomizationCharges: '0.00',
            finalPerPlatePrice: '139.90',
            subtotalAmount: '1399.00',
            deliveryFee: '100.00',
            distanceKm: '5.00',
            deliveryServiceType: 'STANDARD',
            helperCount: 0,
            cutleryIncludedCount: 10,
            cutleryExtraCount: 0,
            cutleryUnitPrice: '5.00',
            cutleryTotal: '0.00',
            items: [],
          },
        },
      ],
    }) as never;

  const prepared = await carts.preparePayment('user-1');
  assert.equal(prepared.totalAmount, '1499.00');
  assert.equal(prepared.carts[0].packageImageUrl, '/pkg-lunch.png');
  assert.equal(prepared.carts[0].selectedItems[0].menuItemName, 'Paneer curry');
  assert.equal(prepared.carts[0].selectedItems[0].role, 'INCLUDED');
  assert.equal(prepared.carts[0].selectedItems[0].quantity, 1);
});

test('payment snapshot preserves booking cutlery on its selected cart', async () => {
  const carts = ['cart-1', 'cart-2'].map((id) => ({
    id,
    userId: 'user-1',
    status: 'ACTIVE',
    packageVersionId: `version-${id}`,
    packageVersion: {
      versionNo: 1,
      package: {
        type: PackageType.CUSTOM_PACKAGE,
        imageUrl: null,
      },
    },
    addressId: 'address-1',
    regionId: 'region-1',
    eventName: null,
    eventDate: new Date('2026-10-20T00:00:00.000Z'),
    eventTimeStart: new Date('1970-01-01T11:30:00.000Z'),
    guestCount: 10,
    deliveryServiceType: 'STANDARD',
    helperCount: 0,
    cutleryExtraCount: id === 'cart-2' ? 5 : 0,
    contactNumber: '9876543210',
    specialNotes: null,
    items: [],
    cutleryItems:
      id === 'cart-2' ? [{ cutleryItemId: 'serving-spoon', quantity: 5 }] : [],
  }));
  const quoteFor = (cartId: string) => ({
    region: { id: 'region-1' },
    packageName: cartId === 'cart-1' ? 'Lunch' : 'Dinner',
    packageType: PackageType.CUSTOM_PACKAGE,
    guestCount: 10,
    basePerPlatePrice: '100.00',
    totalCustomizationCharges: '0.00',
    finalPerPlatePrice: '100.00',
    subtotalAmount: '1000.00',
    deliveryFee: '0.00',
    distanceKm: '5.00',
    deliveryServiceType: 'STANDARD',
    helperCount: 0,
    cutleryIncludedCount: 10,
    cutleryExtraCount: cartId === 'cart-2' ? 5 : 0,
    cutleryUnitPrice: '20.00',
    cutleryTotal: cartId === 'cart-2' ? '100.00' : '0.00',
    cutleryItems:
      cartId === 'cart-2'
        ? [
            {
              id: 'serving-spoon',
              name: 'Serving Spoon',
              unitLabel: 'piece',
              includedQuantity: 0,
              quantity: 5,
              unitPrice: '20.00',
              lineTotal: '100.00',
              imageUrl: null,
            },
          ]
        : [],
    items: [],
  });
  const service = new CartService(
    {
      cart: { findMany: async () => carts },
    } as never,
    {} as never,
    {} as never,
  );
  service.quoteAll = async () =>
    ({
      valid: true,
      carts: carts.map((cart) => ({
        cartId: cart.id,
        quote: quoteFor(cart.id),
      })),
    }) as never;

  const prepared = await service.preparePayment('user-1');

  assert.equal(prepared.totalAmount, '2100.00');
  assert.equal(prepared.carts[0].cutleryTotal, '0.00');
  assert.equal(prepared.carts[0].cutleryExtraCount, 0);
  assert.equal(prepared.carts[1].cutleryTotal, '100.00');
  assert.equal(prepared.carts[1].cutleryExtraCount, 5);
  assert.equal(prepared.carts[1].cutleryItems[0].lineTotal, '100.00');
});

test('50% cart payment keeps carts active and creates a partially paid booking after verification', async () => {
  let attempt: Record<string, unknown> | undefined;
  let attempts = 0;
  const createdOrders: Array<Record<string, unknown>> = [];
  let createdBooking: Record<string, unknown> | undefined;
  let createdPayment: Record<string, unknown> | undefined;
  const prisma = {
    platformSetting: { findUnique: async () => null },
    checkoutAttempt: {
      findMany: async () => [],
      findUnique: async () => attempt,
    },
    $transaction: async (callback: (tx: object) => Promise<unknown>) =>
      callback({
        cart: {
          updateMany: async ({
            data,
          }: {
            data: { paymentTryCount: { increment: number } };
          }) => {
            attempts += data.paymentTryCount.increment;
            return { count: 1 };
          },
          findUnique: async () => ({ cartSessionId: 'session-1' }),
        },
        cartSession: { updateMany: async () => ({ count: 1 }) },
        cartItem: { deleteMany: async () => ({ count: 0 }) },
        userAddress: {
          findFirst: async () => ({
            id: 'address-1',
            addressType: 'EVENT_VENUE',
            label: 'Venue',
            addressLine1: '12 Celebration Road',
            addressLine2: null,
            city: 'Hyderabad',
            state: 'Telangana',
            pincode: '500001',
            landmark: null,
            latitude: new Prisma.Decimal('17.3850'),
            longitude: new Prisma.Decimal('78.4867'),
          }),
        },
        booking: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdBooking = data;
          },
        },
        payment: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdPayment = data;
            return { id: 'payment-1', ...data };
          },
        },
        checkoutAttempt: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            attempt = {
              ...data,
              amount: new Prisma.Decimal(data.amount as string),
              status: CheckoutAttemptStatus.PENDING,
            };
          },
          findUniqueOrThrow: async () => attempt,
          updateMany: async () => ({ count: 1 }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            attempt = { ...attempt, ...data };
          },
        },
        order: {
          count: async () => 0,
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdOrders.push(data);
            return { id: 'confirmed-order-1' };
          },
        },
        $queryRaw: async () => [],
      }),
  };
  const payments = new PaymentsService(
    prisma as never,
    { get: () => undefined } as never,
    { generateBookingDocuments: async () => undefined } as never,
    undefined,
    { preparePayment: async () => snapshot } as never,
  );

  const gateway = await payments.createCartGatewayOrder(
    'user-1',
    undefined,
    PaymentPlan.HALF,
  );
  assert.equal(gateway.localMode, true);
  assert.equal(gateway.amount, 74950);
  assert.equal(attempt?.paymentPlan, PaymentPlan.HALF);
  assert.equal(attempts, 1);
  assert.equal(createdOrders.length, 0);

  const verified = await payments.verify('user-1', {
    razorpayOrderId: gateway.id,
    razorpayPaymentId: 'local-payment-1',
    razorpaySignature: 'local_success',
  });
  assert.equal(verified.success, true);
  assert.equal(verified.bookingId, createdBooking?.id);
  assert.equal(createdOrders.length, 1);
  assert.equal(createdOrders[0].orderStatus, OrderStatus.AWAITING_APPROVAL);
  assert.equal(createdOrders[0].paymentStatus, PaymentStatus.PARTIALLY_PAID);
  assert.equal(createdOrders[0].paymentPlan, PaymentPlan.HALF);
  assert.equal((createdPayment?.amount as Prisma.Decimal).toFixed(2), '749.50');
  assert.equal(createdBooking?.paymentStatus, PaymentStatus.PARTIALLY_PAID);
  assert.equal(createdOrders[0].bookingId, createdBooking?.id);
  assert.equal(createdOrders[0].packageImageUrl, '/pkg-lunch.png');
  assert.equal(attempt?.status, CheckoutAttemptStatus.PAID);

  const repeated = await payments.verify('user-1', {
    razorpayOrderId: gateway.id,
    razorpayPaymentId: 'local-payment-1',
    razorpaySignature: 'local_success',
  });
  assert.equal(repeated.bookingId, createdBooking?.id);
  assert.equal(createdOrders.length, 1);
});

test('failed gateway callbacks update the attempt without creating an order', async () => {
  let state = CheckoutAttemptStatus.PENDING;
  let orderWrites = 0;
  const payments = new PaymentsService(
    {
      checkoutAttempt: {
        findUnique: async () => ({ id: 'attempt-1' }),
        updateMany: async ({
          data,
        }: {
          data: { status: CheckoutAttemptStatus };
        }) => {
          state = data.status;
        },
      },
      order: {
        create: async () => {
          orderWrites += 1;
        },
      },
    } as never,
    { get: () => undefined } as never,
    {} as never,
  );
  const internal = payments as unknown as {
    processWebhook(event: string, payload: object): Promise<void>;
  };
  await internal.processWebhook('payment.failed', {
    payload: {
      payment: {
        entity: {
          id: 'failed-payment-1',
          order_id: 'gateway-order-1',
          amount: 149900,
          status: 'failed',
        },
      },
    },
  });
  assert.equal(state, CheckoutAttemptStatus.FAILED);
  assert.equal(orderWrites, 0);
});

test('pay later creates an unpaid booking awaiting kitchen approval', async () => {
  const currentCart = {
    id: 'cart-1',
    userId: 'user-1',
    packageVersionId: 'version-1',
    addressId: 'address-1',
    regionId: 'region-1',
    eventName: null,
    eventDate: new Date('2026-10-20T00:00:00.000Z'),
    eventTimeStart: new Date('1970-01-01T11:30:00.000Z'),
    guestCount: 10,
    deliveryServiceType: 'STANDARD',
    helperCount: 0,
    cutleryExtraCount: 0,
    contactNumber: '9876543210',
    specialNotes: null,
    items: [],
    cutleryItems: [],
    status: 'ACTIVE',
  };
  const payLaterSnapshot = {
    ...snapshot,
    carts: [
      {
        ...snapshot.carts[0],
        cutleryItems: [],
        cartFingerprint: cartFingerprint(currentCart as never),
      },
    ],
  };
  let createdBooking: Record<string, unknown> | undefined;
  const createdOrders: Array<Record<string, unknown>> = [];
  const notified: string[] = [];
  const payments = new PaymentsService(
    {
      checkoutAttempt: { findMany: async () => [] },
      $transaction: async (callback: (tx: object) => Promise<void>) =>
        callback({
          $queryRaw: async () => [],
          userAddress: {
            findFirst: async () => ({
              id: 'address-1',
              addressType: 'EVENT_VENUE',
              label: 'Venue',
              addressLine1: '12 Celebration Road',
              addressLine2: null,
              city: 'Hyderabad',
              state: 'Telangana',
              pincode: '500001',
              landmark: null,
              latitude: new Prisma.Decimal('17.3850'),
              longitude: new Prisma.Decimal('78.4867'),
            }),
          },
          booking: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              createdBooking = data;
            },
          },
          cart: {
            findFirst: async () => currentCart,
            findUnique: async () => ({ cartSessionId: 'session-1' }),
            deleteMany: async () => ({ count: 1 }),
          },
          cartItem: { deleteMany: async () => ({ count: 0 }) },
          cartSession: { update: async () => undefined },
          order: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              createdOrders.push(data);
              return { id: 'order-pay-later' };
            },
          },
        }),
    } as never,
    { get: () => undefined } as never,
    { generateBookingDocuments: async () => undefined } as never,
    {
      notifyBookingRequest: async (orderId: string) => {
        notified.push(orderId);
      },
    } as never,
    {
      preparePayment: async () => payLaterSnapshot,
    } as never,
  );

  const result = await payments.createPayLaterBooking('user-1');
  assert.equal(result.bookingId, createdBooking?.id);
  assert.equal(result.paymentPlan, PaymentPlan.PAY_LATER);
  assert.equal(createdBooking?.paymentStatus, PaymentStatus.UNPAID);
  assert.equal(createdBooking?.paymentPlan, PaymentPlan.PAY_LATER);
  assert.equal(createdOrders[0].orderStatus, OrderStatus.AWAITING_APPROVAL);
  assert.equal(createdOrders[0].bookingId, createdBooking?.id);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(notified, ['order-pay-later']);
});

test('pay later is blocked while a captured cart payment needs review', async () => {
  let transactionStarted = false;
  const payments = new PaymentsService(
    {
      checkoutAttempt: {
        findMany: async () => [
          {
            id: 'attempt-1',
            status: CheckoutAttemptStatus.NEEDS_REVIEW,
            snapshot,
            razorpayPaymentId: 'gateway-payment-1',
          },
        ],
      },
      $transaction: async () => {
        transactionStarted = true;
      },
    } as never,
    { get: () => undefined } as never,
    {} as never,
    undefined,
    { preparePayment: async () => snapshot } as never,
  );

  await assert.rejects(
    payments.createPayLaterBooking('user-1'),
    /Payment captured; order confirmation is pending/,
  );
  assert.equal(transactionStarted, false);
});

test('50% checkout is calculated once from the final batch total', () => {
  const payments = new PaymentsService(
    {} as never,
    { get: () => undefined } as never,
    {} as never,
  );
  const multiCartSnapshot = {
    totalAmount: '3.02',
    carts: [
      { ...snapshot.carts[0], cartId: 'cart-1', totalAmount: '1.01' },
      { ...snapshot.carts[0], cartId: 'cart-2', totalAmount: '2.01' },
    ],
  } as CheckoutSnapshot;
  const internal = payments as unknown as {
    checkoutCharge(value: CheckoutSnapshot, plan: PaymentPlan): Prisma.Decimal;
    allocateCheckoutPayment(
      value: CheckoutSnapshot,
      plan: PaymentPlan,
    ): Prisma.Decimal[];
  };

  const charge = internal.checkoutCharge(multiCartSnapshot, PaymentPlan.HALF);
  const allocations = internal.allocateCheckoutPayment(
    multiCartSnapshot,
    PaymentPlan.HALF,
  );
  assert.equal(charge.toFixed(2), '1.51');
  assert.equal(
    allocations
      .reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0))
      .toFixed(2),
    '1.51',
  );
});
