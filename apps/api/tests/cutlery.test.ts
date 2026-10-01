import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { CutleryService } from '../src/modules/cutlery/cutlery.service';
import { CartCutlerySelectionDto } from '../src/modules/cutlery/dto/update-cart-cutlery.dto';

test('cart cutlery selections accept seeded catalog identifiers', async () => {
  const dto = Object.assign(new CartCutlerySelectionDto(), {
    itemId: 'cutlery-serving-spoons',
    quantity: 2,
  });
  assert.deepEqual(await validate(dto), []);
});

test('cutlery quotes add independently priced selections', async () => {
  const prisma = {
    cutleryItem: {
      findMany: async () => [
        {
          id: 'cutlery-serving-spoons',
          name: 'Serving Spoons',
          extraLabel: 'Serving Spoons',
          description: null,
          unitLabel: 'piece',
          unitPrice: new Prisma.Decimal('20.00'),
          includedQuantity: 0,
          imageUrl: null,
          displayOrder: 10,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cutlery-spoons-forks',
          name: 'Spoons & Forks',
          extraLabel: 'Extra Spoons & Forks',
          description: null,
          unitLabel: 'set',
          unitPrice: new Prisma.Decimal('5.00'),
          includedQuantity: 10,
          imageUrl: null,
          displayOrder: 40,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
    cartCutleryItem: {
      findMany: async () => [
        { cutleryItemId: 'cutlery-serving-spoons', quantity: 1 },
        { cutleryItemId: 'cutlery-spoons-forks', quantity: 1 },
      ],
    },
  };
  const service = new CutleryService(prisma as never);
  const quote = await service.quote('cart-1');
  assert.equal(quote.total.toFixed(2), '25.00');
  assert.equal(quote.items[1]?.includedQuantity, 10);
});
