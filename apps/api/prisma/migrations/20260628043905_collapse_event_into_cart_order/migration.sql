-- Collapse the former one-cart/one-order Event relay into Cart and immutable Order fields.
-- Columns are populated before constraints or the source table are removed so this
-- migration remains safe if transactional rows exist in another environment.

ALTER TABLE "carts"
  ADD COLUMN "address_id" TEXT,
  ADD COLUMN "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "distance_km" DECIMAL(8,2),
  ADD COLUMN "event_date" DATE,
  ADD COLUMN "event_name" VARCHAR(200),
  ADD COLUMN "event_time_start" TIME,
  ADD COLUMN "guest_count" INTEGER,
  ADD COLUMN "region_id" TEXT,
  ADD COLUMN "special_notes" VARCHAR(1000);

ALTER TABLE "orders"
  ADD COLUMN "address_id" TEXT,
  ADD COLUMN "event_date" DATE,
  ADD COLUMN "event_name" VARCHAR(200),
  ADD COLUMN "event_time_start" TIME,
  ADD COLUMN "special_notes" VARCHAR(1000);

UPDATE "carts" AS cart
SET
  "address_id" = event."address_id",
  "delivery_fee" = event."delivery_fee",
  "distance_km" = event."distance_km",
  "event_date" = event."event_date",
  "event_name" = event."event_name",
  "event_time_start" = event."event_time_start",
  "guest_count" = event."guest_count",
  "region_id" = event."region_id",
  "special_notes" = event."special_notes"
FROM "events" AS event
WHERE cart."event_id" = event."id";

UPDATE "orders" AS orders
SET
  "address_id" = event."address_id",
  "event_date" = event."event_date",
  "event_name" = event."event_name",
  "event_time_start" = event."event_time_start",
  "special_notes" = event."special_notes"
FROM "events" AS event
WHERE orders."event_id" = event."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "orders" WHERE "address_id" IS NULL OR "event_date" IS NULL) THEN
    RAISE EXCEPTION 'Cannot collapse events: an order is missing its source event/address/date';
  END IF;
END $$;

ALTER TABLE "orders"
  ALTER COLUMN "address_id" SET NOT NULL,
  ALTER COLUMN "event_date" SET NOT NULL;

ALTER TABLE "carts" DROP CONSTRAINT "carts_event_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_event_id_fkey";
DROP INDEX "carts_event_id_idx";
DROP INDEX "orders_event_id_idx";
ALTER TABLE "carts" DROP COLUMN "event_id";
ALTER TABLE "orders" DROP COLUMN "event_id";
DROP TABLE "events";
DROP TYPE "EventStatus";

CREATE INDEX "carts_address_id_idx" ON "carts"("address_id");
CREATE INDEX "carts_region_id_event_date_idx" ON "carts"("region_id", "event_date");
CREATE INDEX "orders_address_id_idx" ON "orders"("address_id");
CREATE INDEX "orders_event_date_idx" ON "orders"("event_date");

ALTER TABLE "carts" ADD CONSTRAINT "carts_address_id_fkey"
  FOREIGN KEY ("address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "operating_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey"
  FOREIGN KEY ("address_id") REFERENCES "user_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
