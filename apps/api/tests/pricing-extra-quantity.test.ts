import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PackageMenuItemRole,
  PackageType,
  Prisma,
  SelectedItemRole,
} from '@prisma/client';
import { PricingService } from '../src/modules/pricing/pricing.service';

test('fixed package extras are priced only for the selected quantity', async () => {
  const category = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Dessert',
  };
  const menuItem = {
    id: '22222222-2222-2222-2222-222222222222',
    categoryId: category.id,
    name: 'Gulab Jamun',
    isVeg: true,
    boxPrice: new Prisma.Decimal('0.00'),
    generalPrice: new Prisma.Decimal('100.00'),
  };
  const prisma = {
    packageVersion: {
      findFirst: async () => ({
        id: '33333333-3333-3333-3333-333333333333',
        versionNo: 1,
        minGuestCount: 20,
        maxGuestCount: null,
        basePricePerPlate: new Prisma.Decimal('500.00'),
        package: {
          id: '44444444-4444-4444-4444-444444444444',
          name: 'Fixed Package',
          type: PackageType.FIXED_PACKAGE,
        },
        packageMenuItems: [
          {
            menuItemId: menuItem.id,
            categoryId: category.id,
            role: PackageMenuItemRole.EXTRA,
            menuItem,
            category,
          },
        ],
      }),
    },
  };
  const service = new PricingService(prisma as never);

  const quote = await service.quote(
    '33333333-3333-3333-3333-333333333333',
    20,
    [
      {
        categoryId: category.id,
        menuItemId: menuItem.id,
        role: SelectedItemRole.EXTRA,
        quantity: 6,
      },
    ],
  );
  const serialized = service.serialize(quote);

  assert.equal(serialized.totalCustomizationCharges, '30.00');
  assert.equal(serialized.finalPerPlatePrice, '530.00');
  assert.equal(serialized.totalAmount, '10600.00');
  assert.equal(serialized.items[0].quantity, 6);
  assert.equal(serialized.items[0].totalAdjustmentAmount, '600.00');
});

test('fixed package included items can be swapped within category', async () => {
  const category = { id: '11111111-1111-1111-1111-111111111111', name: 'Main' };
  const includedItem = {
    id: '22222222-2222-2222-2222-222222222222',
    categoryId: category.id,
    name: 'Paneer Curry',
    isVeg: true,
    boxPrice: new Prisma.Decimal('0.00'),
    generalPrice: new Prisma.Decimal('500.00'),
  };
  const replacementItem = {
    id: '55555555-5555-5555-5555-555555555555',
    categoryId: category.id,
    name: 'Paneer Kofta',
    isVeg: true,
    boxPrice: new Prisma.Decimal('0.00'),
    generalPrice: new Prisma.Decimal('650.00'),
  };
  const prisma = {
    packageVersion: {
      findFirst: async () => ({
        id: '33333333-3333-3333-3333-333333333333',
        versionNo: 1,
        minGuestCount: 20,
        maxGuestCount: null,
        basePricePerPlate: new Prisma.Decimal('500.00'),
        package: {
          id: '44444444-4444-4444-4444-444444444444',
          name: 'Fixed Package',
          type: PackageType.FIXED_PACKAGE,
        },
        packageMenuItems: [
          {
            menuItemId: includedItem.id,
            categoryId: category.id,
            role: PackageMenuItemRole.INCLUDED,
            isSwappable: true,
            menuItem: includedItem,
            category,
          },
        ],
      }),
    },
    menuItem: {
      findMany: async () => [replacementItem],
    },
  };
  const service = new PricingService(prisma as never);

  const quote = await service.quote(
    '33333333-3333-3333-3333-333333333333',
    20,
    [
      {
        categoryId: category.id,
        menuItemId: replacementItem.id,
        replacedMenuItemId: includedItem.id,
        role: SelectedItemRole.SWAP,
      },
    ],
  );
  const serialized = service.serialize(quote);

  assert.equal(serialized.totalCustomizationCharges, '150.00');
  assert.equal(serialized.finalPerPlatePrice, '650.00');
  assert.equal(serialized.totalAmount, '13000.00');
  assert.equal(serialized.items[0].role, 'SWAP');
  assert.equal(serialized.items[0].replacedMenuItemName, 'Paneer Curry');
  assert.equal(serialized.items[0].totalAdjustmentAmount, '150.00');
});
