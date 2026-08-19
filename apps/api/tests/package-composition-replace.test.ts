import assert from 'node:assert/strict';
import test from 'node:test';
import { PackageMenuItemRole } from '@prisma/client';
import { PackagesService } from '../src/modules/packages/packages.service';

test('package composition is replaced inside one transaction', async () => {
  const operations: string[] = [];
  let createdRows: Array<Record<string, unknown>> = [];
  const packages = new PackagesService(
    {
      packageVersion: {
        findUnique: async () => ({
          id: 'version-1',
          package: { type: 'FIXED_PACKAGE' },
        }),
      },
      menuItem: {
        findMany: async () => [
          { id: 'item-1', categoryId: 'category-1' },
          { id: 'item-2', categoryId: 'category-2' },
        ],
      },
      $transaction: async (callback: (transaction: object) => Promise<void>) =>
        callback({
          packageMenuItem: {
            deleteMany: async () => {
              operations.push('delete');
            },
            createMany: async ({
              data,
            }: {
              data: Array<Record<string, unknown>>;
            }) => {
              operations.push('create');
              createdRows = data;
            },
          },
        }),
    } as never,
    {} as never,
  );

  const result = await packages.replaceComposition('version-1', {
    items: [
      {
        categoryId: 'category-1',
        menuItemId: 'item-1',
        role: PackageMenuItemRole.INCLUDED,
        isSwappable: true,
      },
      {
        categoryId: 'category-2',
        menuItemId: 'item-2',
        role: PackageMenuItemRole.EXTRA,
      },
    ],
  });

  assert.deepEqual(operations, ['delete', 'create']);
  assert.equal(createdRows.length, 2);
  assert.deepEqual(result, { success: true, configuredItems: 2 });
});

test('package composition rejects menu items assigned to the wrong category', async () => {
  let transactionStarted = false;
  const packages = new PackagesService(
    {
      packageVersion: {
        findUnique: async () => ({
          id: 'version-1',
          package: { type: 'FIXED_PACKAGE' },
        }),
      },
      menuItem: {
        findMany: async () => [{ id: 'item-1', categoryId: 'category-1' }],
      },
      $transaction: async () => {
        transactionStarted = true;
      },
    } as never,
    {} as never,
  );

  await assert.rejects(
    packages.replaceComposition('version-1', {
      items: [
        {
          categoryId: 'category-2',
          menuItemId: 'item-1',
          role: PackageMenuItemRole.INCLUDED,
        },
      ],
    }),
    /do not belong to the selected category/,
  );
  assert.equal(transactionStarted, false);
});

test('package composition rejects roles that do not belong to the package type', async () => {
  let transactionStarted = false;
  const packages = new PackagesService(
    {
      packageVersion: {
        findUnique: async () => ({
          id: 'version-1',
          package: { type: 'MEAL_BOX' },
        }),
      },
      $transaction: async () => {
        transactionStarted = true;
      },
    } as never,
    {} as never,
  );

  await assert.rejects(
    packages.replaceComposition('version-1', {
      items: [
        {
          categoryId: 'category-1',
          menuItemId: 'item-1',
          role: PackageMenuItemRole.EXTRA,
        },
      ],
    }),
    /roles are not valid for this package type/,
  );
  assert.equal(transactionStarted, false);
});
