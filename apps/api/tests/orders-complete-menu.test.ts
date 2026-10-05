import assert from 'node:assert/strict';
import test from 'node:test';
import { OrdersService } from '../src/modules/orders/orders.service';

test('booking order detail uses its immutable menu snapshot without reading the source cart', async () => {
  const selectedItems = [
    {
      id: 'item-1',
      role: 'INCLUDED',
      menuItemName: 'Veg Manchurian',
    },
  ];
  const service = new OrdersService(
    {
      order: {
        findFirst: async () => ({ id: 'order-1', selectedItems }),
      },
      cart: {
        findUnique: async () => {
          throw new Error('Order detail must not depend on a checkout cart');
        },
      },
    } as never,
    {} as never,
  );
  service.serializeOrder = ((order: { selectedItems: unknown[] }) => ({
    selectedItems: order.selectedItems,
  })) as never;

  const order = await service.get('user-1', 'booking-1', 'order-1');
  assert.deepEqual(order.selectedItems, selectedItems);
});
