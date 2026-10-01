import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL(
  '../prisma/migrations/20260628043905_collapse_event_into_cart_order/migration.sql',
  import.meta.url,
);

const kitchenLeadTimeMigrationPath = new URL(
  '../prisma/migrations/20261001220000_kitchen_booking_lead_time/migration.sql',
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

test('kitchen lead-time migration backfills regions before removing the global setting', async () => {
  const sql = await readFile(kitchenLeadTimeMigrationPath, 'utf8');
  const addColumn = sql.indexOf('ADD COLUMN "min_booking_lead_hours"');
  const backfill = sql.indexOf('UPDATE "operating_regions"');
  const removeGlobal = sql.indexOf('DELETE FROM "platform_settings"');

  assert.ok(addColumn >= 0);
  assert.ok(backfill > addColumn);
  assert.ok(removeGlobal > backfill);
  assert.match(sql, /CHECK \("min_booking_lead_hours" >= 0\)/);
});
