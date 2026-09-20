CREATE TABLE "package_region_availabilities" (
  "id" TEXT NOT NULL,
  "package_id" TEXT NOT NULL,
  "region_id" TEXT NOT NULL,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_region_availabilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "package_menu_item_region_availabilities" (
  "id" TEXT NOT NULL,
  "package_menu_item_id" TEXT NOT NULL,
  "region_id" TEXT NOT NULL,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_menu_item_region_availabilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "package_region_availabilities_package_id_region_id_key"
  ON "package_region_availabilities"("package_id", "region_id");
CREATE INDEX "package_region_availabilities_region_id_is_available_idx"
  ON "package_region_availabilities"("region_id", "is_available");
CREATE UNIQUE INDEX "package_menu_item_region_availabilities_package_menu_item_id_region_id_key"
  ON "package_menu_item_region_availabilities"("package_menu_item_id", "region_id");
CREATE INDEX "package_menu_item_region_availabilities_region_id_is_available_idx"
  ON "package_menu_item_region_availabilities"("region_id", "is_available");

ALTER TABLE "package_region_availabilities"
  ADD CONSTRAINT "package_region_availabilities_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_region_availabilities"
  ADD CONSTRAINT "package_region_availabilities_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "operating_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_menu_item_region_availabilities"
  ADD CONSTRAINT "package_menu_item_region_availabilities_package_menu_item_id_fkey"
  FOREIGN KEY ("package_menu_item_id") REFERENCES "package_menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_menu_item_region_availabilities"
  ADD CONSTRAINT "package_menu_item_region_availabilities_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "operating_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
