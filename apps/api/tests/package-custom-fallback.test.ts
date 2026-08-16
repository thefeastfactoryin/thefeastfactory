import assert from 'node:assert/strict';
import test from 'node:test';
import { PackageType, Prisma, SelectedItemRole } from '@prisma/client';
import { PackagesService } from '../src/modules/packages/packages.service';

test('legacy custom package preview accepts its active-catalog fallback items', async () => {
  let itemWhere: Record<string, unknown> | undefined;
  const item = {
    id: 'item-1',
    categoryId: 'category-1',
    name: 'Dish',
    isVeg: true,
    generalPrice: new Prisma.Decimal('100.00'),
    category: { name: 'Mains' },
  };
  const packages = new PackagesService(
    {
      menuItem: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          itemWhere = where;
          return [item];
        },
      },
    } as never,
    {} as never,
  );
  const internal = packages as unknown as {
    evaluateCustomSelection(
      version: object,
      dto: object,
    ): Promise<{ errors: string[]; items: Array<{ menuItemId: string }> }>;
  };

  const result = await internal.evaluateCustomSelection(
    {
      id: 'version-1',
      package: { type: PackageType.CUSTOM_PACKAGE },
      packageMenuItems: [],
    },
    {
      selectedItems: [
        {
          categoryId: item.categoryId,
          menuItemId: item.id,
          role: SelectedItemRole.CUSTOM,
        },
      ],
    },
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.items[0].menuItemId, item.id);
  assert.equal(itemWhere?.packageMenuItems, undefined);
});
