CREATE TYPE "DeliveryServiceType" AS ENUM ('STANDARD', 'DOORSTEP', 'ASSISTED');

ALTER TABLE "carts"
  ADD COLUMN "delivery_service_type" "DeliveryServiceType" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "helper_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ADD COLUMN "delivery_service_type" "DeliveryServiceType" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "helper_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "operating_regions"
SET "delivery_fee_per_km" = 25;
