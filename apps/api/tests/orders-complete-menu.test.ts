import assert from 'node:assert/strict';
import test from 'node:test';
import { PackageType, SelectedItemRole } from '@prisma/client';
import { OrdersService } from '../src/modules/orders/orders.service';

for (const packageType of [PackageType.FIXED_PACKAGE, PackageType.MEAL_BOX]) {
  test(`${packageType} order detail reconstructs included dishes with guest quantities`, async () => {
    const service = new OrdersService(
      {
        order: {
          findFirst: async () => ({
            id: 'order-1',
            cartId: 'cart-1',
            guestCount: 20,
            createdAt: new Date(),
            selectedItems: [],
          }),
        },
        cart: {
          findUnique: async () => ({
            packageVersion: {
              package: { type: packageType },
              packageMenuItems: [
                {
                  id: 'package-item-1',
                  categoryId: 'category-1',
                  menuItemId: 'menu-item-1',
                  menuItem: {
                    name: 'Veg Manchurian',
                    isVeg: true,
                    generalPrice: { toFixed: () => '50.00' },
                  },
                  category: { name: 'Starters' },
                },
              ],
            },
          }),
        },
      } as never,
      {} as never,
      {} as never,
    );
    service.serializeOrder = (() => ({ selectedItems: [] })) as never;

    const order = await service.get('user-1', 'order-1');
    assert.equal(order.selectedItems.length, 1);
    assert.equal(order.selectedItems[0].role, SelectedItemRole.INCLUDED);
    assert.equal(order.selectedItems[0].quantity, 20);
    assert.equal(order.selectedItems[0].menuItemName, 'Veg Manchurian');
  });
}
