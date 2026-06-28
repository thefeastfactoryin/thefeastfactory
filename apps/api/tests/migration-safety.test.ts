import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL(
  '../prisma/migrations/20260628043905_collapse_event_into_cart_order/migration.sql',
  import.meta.url,
);

test('event collapse copies cart/order data and guards required fields before dropping source data', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  const cartCopy = sql.indexOf('UPDATE "carts"');
  const orderCopy = sql.indexOf('UPDATE "orders"');
  const guard = sql.indexOf('Cannot collapse events');
  const drop = sql.indexOf('DROP TABLE "events"');

  assert.ok(cartCopy >= 0 && orderCopy > cartCopy);
  assert.ok(guard > orderCopy);
  assert.ok(drop > guard);
  assert.match(sql, /ALTER COLUMN "address_id" SET NOT NULL/);
  assert.match(sql, /ALTER COLUMN "event_date" SET NOT NULL/);
});
