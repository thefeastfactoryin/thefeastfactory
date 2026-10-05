-- Payments belong to the booking aggregate. Per-package attribution remains in
-- payment_allocations and no longer requires an arbitrary primary order.
UPDATE "payments" AS p
SET "booking_id" = o."booking_id"
FROM "orders" AS o
WHERE p."order_id" = o."id"
  AND p."booking_id" IS NULL
  AND o."booking_id" IS NOT NULL;

-- The production legacy dataset is explicitly disposable. Payments that cannot
-- be attached to a booking cannot be represented in the booking-owned model.
DELETE FROM "refunds"
WHERE "payment_id" IN (
  SELECT "id" FROM "payments" WHERE "booking_id" IS NULL
);
DELETE FROM "payment_allocations"
WHERE "payment_id" IN (
  SELECT "id" FROM "payments" WHERE "booking_id" IS NULL
);
DELETE FROM "booking_documents"
WHERE "payment_id" IN (
  SELECT "id" FROM "payments" WHERE "booking_id" IS NULL
);
DELETE FROM "payments" WHERE "booking_id" IS NULL;

ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_order_id_fkey";
DROP INDEX IF EXISTS "payments_order_id_idx";
ALTER TABLE "payments" DROP COLUMN "order_id";
ALTER TABLE "payments" ALTER COLUMN "booking_id" SET NOT NULL;
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_booking_id_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
