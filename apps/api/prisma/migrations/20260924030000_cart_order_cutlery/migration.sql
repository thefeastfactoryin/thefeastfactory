ALTER TABLE "carts"
  ADD COLUMN "cutlery_included_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cutlery_extra_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cutlery_unit_price" DECIMAL(10, 2) NOT NULL DEFAULT 5;

ALTER TABLE "orders"
  ADD COLUMN "cutlery_included_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cutlery_extra_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cutlery_unit_price" DECIMAL(10, 2) NOT NULL DEFAULT 5,
  ADD COLUMN "cutlery_total" DECIMAL(10, 2) NOT NULL DEFAULT 0;
