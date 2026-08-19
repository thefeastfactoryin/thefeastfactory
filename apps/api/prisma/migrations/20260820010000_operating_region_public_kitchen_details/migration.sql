ALTER TABLE "operating_regions"
  ADD COLUMN "kitchen_address" VARCHAR(600),
  ADD COLUMN "fssai_license_no" VARCHAR(40),
  ADD COLUMN "kitchen_image_url" VARCHAR(500),
  ADD COLUMN "map_url" VARCHAR(500),
  ADD COLUMN "public_display_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "operating_regions_public_display_order_idx"
  ON "operating_regions"("public_display_order");
