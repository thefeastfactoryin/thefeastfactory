import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { CartService } from '../src/modules/cart/cart.service';

test('adding the same package twice creates independent cart records', async () => {
  let sequence = 0;
  const packageVersion = {
    id: 'version-1',
    minGuestCount: 10,
    maxGuestCount: 100,
    versionNo: 1,
    basePricePerPlate: new Prisma.Decimal('499.00'),
    package: {
      id: 'package-1',
      name: 'Corporate Lunch',
      type: 'FIXED_PACKAGE',
    },
  };
  const prisma = {
    packageVersion: { findFirst: async () => packageVersion },
    cart: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: `cart-${++sequence}`,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastQuotedAt: null,
        packageVersion,
        address: null,
        region: null,
        items: [],
        order: null,
      }),
    },
  };
  const service = new CartService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const first = await service.create('user-1', {
    packageVersionId: 'version-1',
    guestCount: 20,
  });
  const second = await service.create('user-1', {
    packageVersionId: 'version-1',
    guestCount: 30,
  });

  assert.notEqual(first.id, second.id);
  assert.equal(first.packageVersionId, second.packageVersionId);
  assert.equal(first.guestCount, 20);
  assert.equal(second.guestCount, 30);
});

test('cart quote combines menu subtotal and delivery fee', async () => {
  const region = {
    id: 'region-1',
    name: 'Hyderabad',
    deliveryFeePerKm: new Prisma.Decimal('10.00'),
  };
  const prisma = {
    cart: {
      findFirst: async () => ({
        id: 'cart-1',
        userId: 'user-1',
        packageVersionId: 'version-1',
        guestCount: 20,
        distanceKm: new Prisma.Decimal('21.10'),
        deliveryFee: new Prisma.Decimal('220.00'),
        region,
        packageVersion: { minGuestCount: 20 },
        items: [],
      }),
      update: async () => ({}),
    },
  };
  const menuQuote = {
    packageVersionId: 'version-1',
    packageName: 'Pooja Package',
    packageVersionNo: 1,
    guestCount: 20,
    basePerPlatePrice: new Prisma.Decimal('499.00'),
    totalCustomizationCharges: new Prisma.Decimal('50.00'),
    finalPerPlatePrice: new Prisma.Decimal('549.00'),
    totalAmount: new Prisma.Decimal('10980.00'),
    items: [],
  };
  const pricing = {
    quote: async () => menuQuote,
    serialize: () => ({
      packageVersionId: 'version-1',
      packageName: 'Pooja Package',
      packageVersionNo: 1,
      guestCount: 20,
      basePerPlatePrice: '499.00',
      totalCustomizationCharges: '50.00',
      finalPerPlatePrice: '549.00',
      totalAmount: '10980.00',
      items: [],
    }),
  };
  const regions = {
    serialize: () => ({ id: region.id, name: region.name }),
  };
  const service = new CartService(
    prisma as never,
    pricing as never,
    {} as never,
    regions as never,
  );

  const quote = await service.quote('user-1', 'cart-1');

  assert.equal(quote.valid, true);
  assert.equal(quote.finalPerPlatePrice, '549.00');
  assert.equal(quote.subtotalAmount, '10980.00');
  assert.equal(quote.deliveryFee, '220.00');
  assert.equal(quote.totalAmount, '11200.00');
  assert.equal(quote.distanceKm, '21.10');
  assert.equal(quote.billableDistanceKm, 22);
});

test('removing an active package cart leaves other deliveries unchanged', async () => {
  const calls: string[] = [];
  const prisma = {
    cart: {
      findFirst: async () => ({
        id: 'cart-1',
        userId: 'user-1',
        deliveryFee: new Prisma.Decimal('220.00'),
      }),
    },
    $transaction: async (callback: (tx: object) => Promise<void>) =>
      callback({
        cartItem: {
          deleteMany: async () => calls.push('items-deleted'),
        },
        cart: {
          delete: async () => calls.push('cart-deleted'),
        },
      }),
  };
  const service = new CartService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );

  assert.deepEqual(await service.removeActive('user-1', 'cart-1'), {
    success: true,
    id: 'cart-1',
  });
  assert.deepEqual(calls, ['items-deleted', 'cart-deleted']);
});

test('package quantities update independently within package limits', async () => {
  let savedCount = 0;
  const cart = {
    id: 'cart-1',
    userId: 'user-1',
    packageVersionId: 'version-1',
    packageVersion: { minGuestCount: 10, maxGuestCount: 50 },
    items: [],
  };
  const prisma = {
    cart: {
      findFirst: async () => cart,
      update: async ({ data }: { data: { guestCount: number } }) => {
        savedCount = data.guestCount;
        return {
          ...cart,
          ...data,
          status: 'ACTIVE',
          expiresAt: null,
          lastQuotedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          order: null,
          address: null,
          region: null,
          packageVersion: {
            ...cart.packageVersion,
            versionNo: 1,
            basePricePerPlate: new Prisma.Decimal('499.00'),
            package: {
              id: 'package-1',
              name: 'Veg box',
              type: 'MEAL_BOX',
            },
          },
        };
      },
    },
  };
  const service = new CartService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const updated = await service.updateQuantity('user-1', 'cart-1', 15);
  assert.equal(savedCount, 15);
  assert.equal(updated.guestCount, 15);
});

test('item replacement targets the requested customer cart', async () => {
  let lookupWhere: Record<string, unknown> | undefined;
  const transactionFailure = new Error('stop after cart authorization');
  const prisma = {
    cart: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        lookupWhere = where;
        return {
          id: 'cart-2',
          userId: 'user-1',
          packageVersionId: 'version-2',
          packageVersion: { minGuestCount: 10 },
          items: [],
        };
      },
    },
    $transaction: async () => {
      throw transactionFailure;
    },
  };
  const service = new CartService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.replaceItems('user-1', 'cart-2', { items: [] }),
    transactionFailure,
  );
  assert.equal(lookupWhere?.id, 'cart-2');
  assert.equal(lookupWhere?.userId, 'user-1');
  assert.equal(lookupWhere?.status, 'ACTIVE');
  const expiryScope = lookupWhere?.OR as Array<{
    expiresAt: null | { gt: Date };
  }>;
  assert.equal(expiryScope[0].expiresAt, null);
  assert.ok(
    expiryScope[1].expiresAt && expiryScope[1].expiresAt.gt instanceof Date,
  );
});

test('batch checkout validates every cart before creating any order', async () => {
  let createdOrders = 0;
  const carts = ['cart-1', 'cart-2'].map((id) => ({
    id,
    userId: 'user-1',
    addressId: 'address-1',
    eventDate: new Date('2026-08-10T00:00:00.000Z'),
    eventTimeStart: new Date('1970-01-01T18:00:00.000Z'),
    guestCount: 20,
    items: [],
  }));
  const prisma = {
    cart: {
      findMany: async () => carts,
      findFirst: async ({ where }: { where: { id: string } }) => ({
        ...carts.find((cart) => cart.id === where.id),
        packageVersionId: `version-${where.id}`,
        packageVersion: { minGuestCount: 20 },
        region: null,
        distanceKm: null,
        deliveryFee: new Prisma.Decimal(0),
      }),
      update: async () => ({}),
    },
  };
  const pricing = {
    quote: async (versionId: string) => {
      if (versionId.endsWith('cart-2')) throw new Error('stale menu');
      return { totalAmount: new Prisma.Decimal(100) };
    },
    serialize: () => ({ totalAmount: '100.00' }),
  };
  const orders = {
    create: async () => {
      createdOrders += 1;
      return {};
    },
  };
  const service = new CartService(
    prisma as never,
    pricing as never,
    orders as never,
    {} as never,
  );

  await assert.rejects(service.checkoutAll('user-1'), /stale menu/);
  assert.equal(createdOrders, 0);
});

test('active cart queries exclude expired carts while allowing legacy null expiry', async () => {
  let lookupWhere: Record<string, unknown> | undefined;
  const prisma = {
    cart: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        lookupWhere = where;
        return [];
      },
    },
  };
  const service = new CartService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );

  assert.deepEqual(await service.getAllActive('user-1'), []);
  const expiryScope = lookupWhere?.OR as Array<{
    expiresAt: null | { gt: Date };
  }>;
  assert.equal(expiryScope[0].expiresAt, null);
  assert.ok(
    expiryScope[1].expiresAt && expiryScope[1].expiresAt.gt instanceof Date,
  );
});
