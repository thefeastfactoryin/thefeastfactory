import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  PackageType,
  Prisma,
  SelectedItemRole,
} from '@prisma/client';
import { PricingService } from '../src/modules/pricing/pricing.service';

test('custom packages reject active menu items not configured for the version', async () => {
  const configuredItem = {
    id: 'configured-item',
    categoryId: 'category-1',
    name: 'Configured dish',
    isVeg: true,
    generalPrice: new Prisma.Decimal('100.00'),
    category: { name: 'Mains' },
  };
  const unrelatedItem = {
    ...configuredItem,
    id: 'unrelated-item',
    name: 'Unrelated dish',
  };
  const version = {
    id: 'version-1',
    minGuestCount: 10,
    maxGuestCount: 100,
    basePricePerPlate: new Prisma.Decimal(0),
    package: { name: 'Custom', type: PackageType.CUSTOM_PACKAGE },
    packageMenuItems: [
      {
        menuItemId: configuredItem.id,
        menuItem: configuredItem,
        category: configuredItem.category,
      },
    ],
  };
  const pricing = new PricingService({
    packageVersion: { findFirst: async () => version },
    menuItem: { findMany: async () => [unrelatedItem] },
  } as never);

  await assert.rejects(
    pricing.quote('version-1', 20, [
      {
        categoryId: unrelatedItem.categoryId,
        menuItemId: unrelatedItem.id,
        role: SelectedItemRole.CUSTOM,
      },
    ]),
    BadRequestException,
  );
});

test('legacy custom packages without an allowlist retain the active-catalog fallback', async () => {
  const item = {
    id: 'catalog-item',
    categoryId: 'category-1',
    name: 'Catalog dish',
    isVeg: true,
    generalPrice: new Prisma.Decimal('100.00'),
    category: { name: 'Mains' },
  };
  const pricing = new PricingService({
    packageVersion: {
      findFirst: async () => ({
        id: 'version-legacy',
        versionNo: 1,
        minGuestCount: 10,
        maxGuestCount: 100,
        basePricePerPlate: new Prisma.Decimal(0),
        package: { name: 'Custom', type: PackageType.CUSTOM_PACKAGE },
        packageMenuItems: [],
      }),
    },
    menuItem: { findMany: async () => [item] },
  } as never);

  const quote = await pricing.quote('version-legacy', 20, [
    {
      categoryId: item.categoryId,
      menuItemId: item.id,
      role: SelectedItemRole.CUSTOM,
    },
  ]);
  assert.equal(quote.items[0].menuItemId, item.id);
});
