CREATE TYPE "OrderingOfferingCode" AS ENUM ('MEAL_BOX', 'PACKAGES', 'CUSTOM_MENU');

ALTER TABLE "packages"
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "featured_order" INTEGER;

CREATE INDEX "packages_is_featured_featured_order_idx"
  ON "packages"("is_featured", "featured_order");

CREATE TABLE "ordering_offerings" (
  "id" TEXT NOT NULL,
  "code" "OrderingOfferingCode" NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ordering_offerings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ordering_offerings_code_key" ON "ordering_offerings"("code");
CREATE INDEX "ordering_offerings_is_active_display_order_idx" ON "ordering_offerings"("is_active", "display_order");

-- Diet belongs to menu items, not category names. Re-point all dependent rows
-- before removing the old category records.
INSERT INTO "menu_categories" ("id", "name", "description", "display_order", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'Starters', 'Starters and appetisers', MIN("display_order"), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menu_categories" WHERE "name" IN ('Veg Starters', 'Non Veg Starters')
HAVING COUNT(*) > 0
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "menu_categories" ("id", "name", "description", "display_order", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'Curry', 'Main-course curries', MIN("display_order"), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "menu_categories" WHERE "name" IN ('Veg Curry', 'Non Veg Curry')
HAVING COUNT(*) > 0
ON CONFLICT ("name") DO NOTHING;

UPDATE "menu_items" SET "category_id" = target."id"
FROM "menu_categories" source, "menu_categories" target
WHERE source."name" IN ('Veg Starters', 'Non Veg Starters')
  AND target."name" = 'Starters' AND "menu_items"."category_id" = source."id";
UPDATE "package_menu_items" SET "category_id" = target."id"
FROM "menu_categories" source, "menu_categories" target
WHERE source."name" IN ('Veg Starters', 'Non Veg Starters')
  AND target."name" = 'Starters' AND "package_menu_items"."category_id" = source."id";
UPDATE "cart_items" SET "category_id" = target."id"
FROM "menu_categories" source, "menu_categories" target
WHERE source."name" IN ('Veg Starters', 'Non Veg Starters')
  AND target."name" = 'Starters' AND "cart_items"."category_id" = source."id";
UPDATE "order_selected_items" SET "category_id" = target."id"
FROM "menu_categories" source, "menu_categories" target
WHERE source."name" IN ('Veg Starters', 'Non Veg Starters')
  AND target."name" = 'Starters' AND "order_selected_items"."category_id" = source."id";

UPDATE "menu_items" SET "category_id" = target."id"
FROM "menu_categories" source, "menu_categories" target
WHERE source."name" IN ('Veg Curry', 'Non Veg Curry')
  AND target."name" = 'Curry' AND "menu_items"."category_id" = source."id";
UPDATE "package_menu_items" SET "category_id" = target."id"
FROM "menu_categories" source, "menu_categories" target
WHERE source."name" IN ('Veg Curry', 'Non Veg Curry')
  AND target."name" = 'Curry' AND "package_menu_items"."category_id" = source."id";
UPDATE "cart_items" SET "category_id" = target."id"
FROM "menu_categories" source, "menu_categories" target
WHERE source."name" IN ('Veg Curry', 'Non Veg Curry')
  AND target."name" = 'Curry' AND "cart_items"."category_id" = source."id";
UPDATE "order_selected_items" SET "category_id" = target."id"
FROM "menu_categories" source, "menu_categories" target
WHERE source."name" IN ('Veg Curry', 'Non Veg Curry')
  AND target."name" = 'Curry' AND "order_selected_items"."category_id" = source."id";

DELETE FROM "menu_categories" WHERE "name" IN ('Veg Starters', 'Non Veg Starters', 'Veg Curry', 'Non Veg Curry');
