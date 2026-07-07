import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { ImportMenuItemsDto } from '../src/modules/menu/dto/import-menu-items.dto';
import { MenuService } from '../src/modules/menu/menu.service';

test('menu import DTO validates rows and rejects unsafe price formats', async () => {
  const valid = plainToInstance(ImportMenuItemsDto, {
    duplicateStrategy: 'UPDATE',
    createMissingCategories: false,
    rows: [
      {
        category: 'Starters',
        name: 'Paneer Tikka',
        boxPrice: '120.00',
        generalPrice: '150.00',
        foodType: 'VEG',
        isActive: true,
      },
    ],
  });
  assert.deepEqual(await validate(valid), []);

  const invalid = plainToInstance(ImportMenuItemsDto, {
    duplicateStrategy: 'OVERWRITE_EVERYTHING',
    rows: [
      {
        category: 'Starters',
        name: 'Paneer Tikka',
        boxPrice: '-1',
        generalPrice: 'one hundred',
        foodType: 'MAYBE',
      },
    ],
  });
  const errors = await validate(invalid);
  assert.ok(errors.length >= 2);
});

test('menu import skips matching items without writing', async () => {
  let writes = 0;
  const category = {
    id: 'category-1',
    name: 'Starters',
    description: null,
    displayOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const item = {
    id: 'item-1',
    categoryId: category.id,
    name: 'Paneer Tikka',
    description: null,
    boxPrice: new Prisma.Decimal('120.00'),
    generalPrice: new Prisma.Decimal('150.00'),
    isVeg: true,
    isActive: true,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const transaction = {
    menuCategory: {
      findMany: async () => [category],
      create: async () => {
        writes += 1;
        return category;
      },
    },
    menuItem: {
      findMany: async () => [item],
      create: async () => {
        writes += 1;
        return item;
      },
      update: async () => {
        writes += 1;
        return item;
      },
    },
  };
  const service = new MenuService({
    $transaction: async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
  } as never);

  const result = await service.importItems({
    duplicateStrategy: 'SKIP',
    createMissingCategories: false,
    rows: [
      {
        category: 'Starters',
        name: 'Paneer Tikka',
        boxPrice: '120.00',
        generalPrice: '150.00',
        foodType: 'VEG',
        isActive: true,
      },
    ],
  });

  assert.deepEqual(result, { total: 1, created: 0, updated: 0, skipped: 1 });
  assert.equal(writes, 0);
});
