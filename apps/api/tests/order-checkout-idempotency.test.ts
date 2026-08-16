import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderStatus, Prisma } from '@prisma/client';
import { OrdersService } from '../src/modules/orders/orders.service';

test('a concurrent checkout uniqueness race returns the winning order', async () => {
  const cart = {
    id: 'cart-1',
    userId: 'user-1',
    status: 'ACTIVE',
    packageVersionId: 'version-1',
    guestCount: 20,
    addressId: 'address-1',
    address: { latitude: 17.4, longitude: 78.4 },
    region: {
      id: 'region-1',
      deliveryFeePerKm: new Prisma.Decimal('10.00'),
    },
    distanceKm: new Prisma.Decimal('5.00'),
    deliveryFee: new Prisma.Decimal('50.00'),
    eventDate: new Date('2026-08-10T00:00:00.000Z'),
    eventTimeStart: new Date('1970-01-01T18:00:00.000Z'),
    eventName: null,
    specialNotes: null,
    order: null,
  };
  const winningOrder = {
    id: 'order-1',
    userId: 'user-1',
    cartId: 'cart-1',
    orderStatus: OrderStatus.PENDING_PAYMENT,
  };
  const prisma = {
    cart: { findFirst: async () => cart },
    order: {
      findUnique: async () => ({ id: 'order-1', userId: 'user-1' }),
      findFirst: async () => winningOrder,
    },
    $transaction: async () => {
      throw { code: 'P2002' };
    },
  };
  const pricing = {
    quote: async () => ({
      guestCount: 20,
      totalAmount: new Prisma.Decimal('1000.00'),
      basePerPlatePrice: new Prisma.Decimal('50.00'),
      totalCustomizationCharges: new Prisma.Decimal('0.00'),
      finalPerPlatePrice: new Prisma.Decimal('50.00'),
      packageName: 'Package',
      packageVersionNo: 1,
      items: [],
    }),
  };
  const service = new OrdersService(
    prisma as never,
    pricing as never,
    { serialize: () => null } as never,
  );
  const getCalls: string[] = [];
  service.get = async (_userId: string, id: string) => {
    getCalls.push(id);
    return winningOrder as never;
  };

  const result = await service.create(
    'user-1',
    { selectedItems: [] },
    'cart-1',
  );
  assert.equal(result.id, 'order-1');
  assert.deepEqual(getCalls, ['order-1']);
});
