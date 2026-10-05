-- Orders are package snapshots inside a booking. Standalone legacy orders are
-- intentionally removed before enforcing the aggregate boundary.
DELETE FROM "payment_allocations"
WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "booking_id" IS NULL);

DELETE FROM "order_status_history"
WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "booking_id" IS NULL);

DELETE FROM "order_selected_items"
WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "booking_id" IS NULL);

DELETE FROM "order_cutlery_items"
WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "booking_id" IS NULL);

DELETE FROM "orders" WHERE "booking_id" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "booking_id" SET NOT NULL;
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_booking_id_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
