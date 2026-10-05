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

const bookingAggregateMigrationPath = new URL(
  '../prisma/migrations/20261003120000_booking_aggregate/migration.sql',
  import.meta.url,
);

const bookingOwnedPaymentsMigrationPath = new URL(
  '../prisma/migrations/20261005100000_booking_owned_payments/migration.sql',
  import.meta.url,
);

const bookingOwnedOrdersMigrationPath = new URL(
  '../prisma/migrations/20261005110000_remove_legacy_order_paths/migration.sql',
  import.meta.url,
);

const legacyCartOrderLinkMigrationPath = new URL(
  '../prisma/migrations/20261005120000_remove_legacy_cart_order_link/migration.sql',
  import.meta.url,
);

const prismaSchemaPath = new URL('../prisma/schema.prisma', import.meta.url);

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

test('booking payment allocations use payment ownership without a duplicate booking column', async () => {
  const [sql, schema] = await Promise.all([
    readFile(bookingAggregateMigrationPath, 'utf8'),
    readFile(prismaSchemaPath, 'utf8'),
  ]);
  const allocationTable = sql.match(
    /CREATE TABLE "payment_allocations" \([\s\S]*?\n\);/,
  )?.[0];
  const allocationModel = schema.match(
    /model PaymentAllocation \{[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(allocationTable);
  assert.ok(allocationModel);
  assert.doesNotMatch(allocationTable, /"booking_id"/);
  assert.doesNotMatch(allocationModel, /bookingId|booking\s+Booking/);
  assert.match(allocationModel, /paymentId String/);
  assert.match(allocationModel, /orderId\s+String/);
});

test('payments migrate to required booking ownership and drop arbitrary order ownership', async () => {
  const [sql, schema] = await Promise.all([
    readFile(bookingOwnedPaymentsMigrationPath, 'utf8'),
    readFile(prismaSchemaPath, 'utf8'),
  ]);
  const paymentModel = schema.match(/model Payment \{[\s\S]*?\n\}/)?.[0];

  assert.ok(paymentModel);
  assert.match(sql, /SET "booking_id" = o\."booking_id"/);
  assert.match(sql, /DROP COLUMN "order_id"/);
  assert.match(sql, /ALTER COLUMN "booking_id" SET NOT NULL/);
  assert.match(paymentModel, /bookingId\s+String\s+@map\("booking_id"\)/);
  assert.doesNotMatch(paymentModel, /orderId|order\s+Order/);
});

test('standalone legacy orders are removed before booking ownership becomes required', async () => {
  const [sql, schema] = await Promise.all([
    readFile(bookingOwnedOrdersMigrationPath, 'utf8'),
    readFile(prismaSchemaPath, 'utf8'),
  ]);
  const orderModel = schema.match(/model Order \{[\s\S]*?\n\}/)?.[0];

  assert.ok(orderModel);
  assert.match(sql, /DELETE FROM "orders" WHERE "booking_id" IS NULL/);
  assert.match(sql, /ALTER COLUMN "booking_id" SET NOT NULL/);
  assert.match(orderModel, /bookingId\s+String\s+@map\("booking_id"\)/);
  assert.match(orderModel, /booking\s+Booking\s+@relation/);
});

test('orders retain cart provenance without owning checkout carts', async () => {
  const [sql, schema] = await Promise.all([
    readFile(legacyCartOrderLinkMigrationPath, 'utf8'),
    readFile(prismaSchemaPath, 'utf8'),
  ]);
  const cartModel = schema.match(/model Cart \{[\s\S]*?\n\}/)?.[0];
  const orderModel = schema.match(/model Order \{[\s\S]*?\n\}/)?.[0];

  assert.ok(cartModel);
  assert.ok(orderModel);
  assert.match(sql, /DROP COLUMN IF EXISTS "cart_id"/);
  assert.doesNotMatch(cartModel, /\n\s+order\s+Order/);
  assert.doesNotMatch(orderModel, /cartId|\n\s+cart\s+Cart/);
  assert.match(orderModel, /sourceCartId\s+String\?/);
});
