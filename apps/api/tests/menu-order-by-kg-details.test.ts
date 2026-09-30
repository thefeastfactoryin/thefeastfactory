import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { CreateMenuItemDto } from '../src/modules/menu/dto/create-menu-item.dto';
import { MenuService } from '../src/modules/menu/menu.service';

const baseItem = {
  id: 'item-1',
  categoryId: 'category-1',
  name: 'Chicken biryani',
  description: 'Traditional biryani',
  orderByKgDetails: null as string | null,
  boxPrice: new Prisma.Decimal('200.00'),
  generalPrice: new Prisma.Decimal('250.00'),
  pricePerKg: new Prisma.Decimal('600.00'),
  isVeg: false,
  isActive: true,
  imageUrl: null,
};

test('order-by-kg details accept short text and reject text over 300 characters', async () => {
  const dto = plainToInstance(CreateMenuItemDto, {
    categoryId: '9ec0cfb7-5ac1-432e-8571-dbe17f480333',
    name: baseItem.name,
    boxPrice: '200.00',
    generalPrice: '250.00',
    orderByKgDetails: 'Approx. 300 g chicken and 700 g rice per kg',
  });
  assert.deepEqual(await validate(dto), []);
  dto.orderByKgDetails = 'x'.repeat(301);
  assert.ok((await validate(dto)).some((error) => error.property === 'orderByKgDetails'));
});

test('admin create and edit trim or clear order-by-kg details', async () => {
  const writes: Array<Record<string, unknown>> = [];
  const service = new MenuService({
    menuCategory: { findUnique: async () => ({ id: baseItem.categoryId }) },
    menuItem: {
      findFirst: async () => baseItem,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data);
        return { ...baseItem, ...data };
      },
    },
    $transaction: async (
      callback: (client: {
        menuItem: { update: (args: { data: Record<string, unknown> }) => Promise<object> };
      }) => Promise<unknown>,
    ) =>
      callback({
        menuItem: {
          update: async ({ data }) => {
            writes.push(data);
            return { ...baseItem, ...data };
          },
        },
      }),
  } as never);

  const created = await service.createItem({
    categoryId: baseItem.categoryId,
    name: baseItem.name,
    boxPrice: '200.00',
    generalPrice: '250.00',
    orderByKgDetails: '  Approx. 300 g chicken per kg  ',
  });
  assert.equal(created.orderByKgDetails, 'Approx. 300 g chicken per kg');
  assert.equal(writes[0].orderByKgDetails, 'Approx. 300 g chicken per kg');

  await service.updateItem(baseItem.id, { orderByKgDetails: '' });
  assert.equal(writes[1].orderByKgDetails, null);
});
