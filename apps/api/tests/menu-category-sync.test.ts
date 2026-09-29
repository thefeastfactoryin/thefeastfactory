import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { MenuService } from '../src/modules/menu/menu.service';

test('saving a menu item category reconciles its package compositions', async () => {
  const packageUpdates: Array<Record<string, unknown>> = [];
  const category = {
    id: 'accompaniments',
    name: 'Accompaniments',
    description: null,
    displayOrder: 4,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const existingItem = {
    id: 'fryums',
    categoryId: category.id,
    name: 'Fryums',
    description: null,
    boxPrice: new Prisma.Decimal('20.00'),
    generalPrice: new Prisma.Decimal('25.00'),
    pricePerKg: null,
    isVeg: true,
    isActive: true,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const transaction = {
    menuItem: {
      update: async ({ data }: { data: { categoryId?: string } }) => ({
        ...existingItem,
        ...data,
        category,
      }),
    },
    packageMenuItem: {
      updateMany: async (args: Record<string, unknown>) => {
        packageUpdates.push(args);
        return { count: 3 };
      },
    },
  };
  const service = new MenuService({
    menuItem: {
      findFirst: async () => existingItem,
    },
    menuCategory: {
      findUnique: async () => category,
    },
    $transaction: async (
      callback: (client: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
  } as never);

  const result = await service.updateItem(existingItem.id, {
    categoryId: category.id,
  });

  assert.equal(result.categoryId, category.id);
  assert.equal(result.category.name, category.name);
  assert.deepEqual(packageUpdates, [
    {
      where: { menuItemId: existingItem.id },
      data: { categoryId: category.id },
    },
  ]);
});
