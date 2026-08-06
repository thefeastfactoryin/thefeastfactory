import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { CartService } from '../src/modules/cart/cart.service';

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

test('removing an active package cart preserves the shared delivery fee', async () => {
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
          findFirst: async () => ({ id: 'cart-2' }),
          update: async ({ data }: { data: { deliveryFee: Prisma.Decimal } }) =>
            calls.push(`fee-${data.deliveryFee.toFixed(2)}`),
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
  assert.deepEqual(calls, ['items-deleted', 'cart-deleted', 'fee-220.00']);
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
