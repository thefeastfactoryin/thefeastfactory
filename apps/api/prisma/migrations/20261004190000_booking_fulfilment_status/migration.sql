CREATE TYPE "BookingFulfilmentStatus" AS ENUM (
  'NOT_STARTED',
  'PREPARING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'COMPLETED'
);

ALTER TABLE "bookings"
ADD COLUMN "fulfilment_status" "BookingFulfilmentStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- Preserve the furthest operational state reached by any package in each
-- existing booking. From this point onward the booking is the workflow owner.
UPDATE "bookings" b
SET "fulfilment_status" = CASE
  WHEN b."status" = 'COMPLETED' THEN 'COMPLETED'::"BookingFulfilmentStatus"
  WHEN EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o."booking_id" = b."id" AND o."order_status" = 'DELIVERED'
  ) THEN 'COMPLETED'::"BookingFulfilmentStatus"
  WHEN EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o."booking_id" = b."id" AND o."order_status" = 'OUT_FOR_DELIVERY'
  ) THEN 'OUT_FOR_DELIVERY'::"BookingFulfilmentStatus"
  WHEN EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o."booking_id" = b."id" AND o."order_status" = 'READY_FOR_DELIVERY'
  ) THEN 'READY_FOR_DELIVERY'::"BookingFulfilmentStatus"
  WHEN EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o."booking_id" = b."id" AND o."order_status" = 'IN_PROGRESS'
  ) THEN 'PREPARING'::"BookingFulfilmentStatus"
  ELSE 'NOT_STARTED'::"BookingFulfilmentStatus"
END;

CREATE TABLE "booking_fulfilment_history" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "from_status" "BookingFulfilmentStatus",
  "to_status" "BookingFulfilmentStatus" NOT NULL,
  "changed_by_id" TEXT,
  "notes" VARCHAR(500),
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_fulfilment_history_pkey" PRIMARY KEY ("id")
);

INSERT INTO "booking_fulfilment_history" (
  "id", "booking_id", "from_status", "to_status", "notes", "changed_at"
)
SELECT
  'migration:' || b."id",
  b."id",
  NULL,
  b."fulfilment_status",
  'Initial fulfilment state migrated from package orders',
  b."updated_at"
FROM "bookings" b;

CREATE INDEX "booking_fulfilment_history_booking_id_changed_at_idx"
ON "booking_fulfilment_history"("booking_id", "changed_at");

CREATE INDEX "bookings_region_id_fulfilment_status_idx"
ON "bookings"("region_id", "fulfilment_status");

ALTER TABLE "booking_fulfilment_history"
ADD CONSTRAINT "booking_fulfilment_history_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_fulfilment_history"
ADD CONSTRAINT "booking_fulfilment_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "admin_users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
