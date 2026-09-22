import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PackageMenuItemRole,
  PackageType,
  Prisma,
  SelectedItemRole,
} from '@prisma/client';
import { PricingService } from '../src/modules/pricing/pricing.service';

function setup() {
  const category = { id: 'category', name: 'Rice', isActive: true };
  const menuItem = {
    id: 'dish',
    categoryId: category.id,
    name: 'Biryani',
    isVeg: true,
    isActive: true,
    deletedAt: null,
    pricePerKg: new Prisma.Decimal('400.01'),
    generalPrice: new Prisma.Decimal(90),
    boxPrice: new Prisma.Decimal(50),
  };
  const row = {
    menuItemId: menuItem.id,
    categoryId: category.id,
    isAvailable: true,
    role: PackageMenuItemRole.CUSTOM_SELECTABLE,
    menuItem,
    category,
    regionAvailabilities: [] as Array<{ isAvailable: boolean }>,
  };
  const version = {
    id: 'version',
    versionNo: 1,
    minGuestCount: 10,
    maxGuestCount: 20,
    kgDefaultWeightGrams: 1000,
    kgWeightIncrementGrams: 500,
    basePricePerPlate: new Prisma.Decimal(0),
    package: {
      name: 'KG Menu',
      type: PackageType.ORDER_BY_KG as PackageType,
      regionAvailabilities: [] as Array<{ isAvailable: boolean }>,
    },
    packageMenuItems: [row],
  };
  const service = new PricingService({
    packageVersion: { findFirst: async () => version },
  } as never);
  const selection = {
    categoryId: category.id,
    menuItemId: menuItem.id,
    role: SelectedItemRole.CUSTOM,
    quantity: 1,
    weightGrams: 1500,
  };
  return { service, version, row, menuItem, category, selection };
}

test('KG pricing rounds each weight line and does not multiply by guest count or use portion prices', async () => {
  const { service, selection } = setup();
  for (const guestCount of [1, 100]) {
    const quote = service.serialize(
      await service.quote('version', guestCount, [selection]),
    );
    assert.equal(quote.totalAmount, '600.02');
    assert.equal(quote.guestCount, null);
    assert.equal(quote.basePerPlatePrice, null);
    assert.equal(quote.finalPerPlatePrice, null);
    assert.equal(quote.items[0].pricePerKg, '400.01');
    assert.equal(quote.items[0].weightGrams, 1500);
    assert.equal(quote.items[0].lineTotal, '600.02');
  }
});

test('KG menu requires an explicit allowlist and a selection', async () => {
  const { service, version, selection } = setup();
  await assert.rejects(() => service.quote('version', 1, []));
  version.packageMenuItems = [];
  await assert.rejects(() => service.quote('version', 1, [selection]));
});

test('KG menu rejects invalid weight, portions, swaps, roles and duplicate dishes', async () => {
  const { service, selection } = setup();
  for (const weightGrams of [
    undefined,
    null,
    0,
    -500,
    250,
    500,
    501,
    1500.5,
    100500,
    Infinity,
    NaN,
  ]) {
    await assert.rejects(() =>
      service.quote('version', 1, [{ ...selection, weightGrams }]),
    );
  }
  for (const change of [
    { quantity: 2 },
    { role: SelectedItemRole.EXTRA },
    { replacedMenuItemId: 'dish2' },
    { categoryId: 'wrong' },
  ]) {
    await assert.rejects(() =>
      service.quote('version', 1, [{ ...selection, ...change }]),
    );
  }
  await assert.rejects(() =>
    service.quote('version', 1, [selection, selection]),
  );
});

test('KG menu rejects disabled or unpriced dishes and inactive categories', async () => {
  for (const modify of [
    (f: ReturnType<typeof setup>) => {
      f.row.isAvailable = false;
    },
    (f: ReturnType<typeof setup>) => {
      f.menuItem.isActive = false;
    },
    (f: ReturnType<typeof setup>) => {
      f.category.isActive = false;
    },
    (f: ReturnType<typeof setup>) => {
      f.menuItem.pricePerKg = new Prisma.Decimal(0);
    },
    (f: ReturnType<typeof setup>) => {
      f.row.role = PackageMenuItemRole.INCLUDED;
    },
  ]) {
    const f = setup();
    modify(f);
    await assert.rejects(() => f.service.quote('version', 1, [f.selection]));
  }
});

test('KG quote refresh uses the latest rate and permits valid boundary weights', async () => {
  const f = setup();
  f.menuItem.pricePerKg = new Prisma.Decimal(500);
  assert.equal(
    (
      await f.service.quote('version', 1, [
        { ...f.selection, weightGrams: 1000 },
      ])
    ).totalAmount.toFixed(2),
    '500.00',
  );
  assert.equal(
    (
      await f.service.quote('version', 1, [
        { ...f.selection, weightGrams: 100000 },
      ])
    ).totalAmount.toFixed(2),
    '50000.00',
  );
});

test('KG pricing enforces the configured starting weight and increment', async () => {
  const f = setup();
  f.version.kgDefaultWeightGrams = 1500;
  f.version.kgWeightIncrementGrams = 1000;
  for (const weightGrams of [1500, 2500, 3500, 99500]) {
    await assert.doesNotReject(() =>
      f.service.quote('version', 1, [{ ...f.selection, weightGrams }]),
    );
  }
  for (const weightGrams of [1000, 2000, 3000, 100000]) {
    await assert.rejects(() =>
      f.service.quote('version', 1, [{ ...f.selection, weightGrams }]),
    );
  }
});

test('KG customer ordering respects package and dish availability for the selected location', async () => {
  const f = setup();
  f.version.package.regionAvailabilities = [{ isAvailable: false }];
  await assert.rejects(
    () => f.service.quote('version', 1, [f.selection], 'region'),
    /unavailable at this location/,
  );
  f.version.package.regionAvailabilities = [{ isAvailable: true }];
  f.row.regionAvailabilities = [{ isAvailable: false }];
  await assert.rejects(
    () => f.service.quote('version', 1, [f.selection], 'region'),
    /not available for kg ordering/,
  );
  assert.equal(
    (await f.service.quote('version', 1, [f.selection])).totalAmount.toFixed(2),
    '600.02',
  );
});

test('KG prices that overflow persisted money are rejected', async () => {
  const f = setup();
  f.menuItem.pricePerKg = new Prisma.Decimal('99999999.99');
  await assert.rejects(() =>
    f.service.quote('version', 1, [{ ...f.selection, weightGrams: 100000 }]),
  );
});

test('portion-based packages reject weight fields', async () => {
  const f = setup();
  f.version.package.type = PackageType.FIXED_PACKAGE;
  await assert.rejects(() => f.service.quote('version', 10, [f.selection]));
});
