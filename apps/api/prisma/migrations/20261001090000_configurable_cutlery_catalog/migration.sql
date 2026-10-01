CREATE TABLE "cutlery_items" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "extra_label" VARCHAR(100),
  "description" VARCHAR(300),
  "unit_label" VARCHAR(30) NOT NULL DEFAULT 'piece',
  "unit_price" DECIMAL(10, 2) NOT NULL,
  "included_quantity" INTEGER NOT NULL DEFAULT 0,
  "image_url" VARCHAR(500),
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cutlery_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_cutlery_items" (
  "id" TEXT NOT NULL,
  "cart_id" TEXT NOT NULL,
  "cutlery_item_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cart_cutlery_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_cutlery_items" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "cutlery_item_id" TEXT,
  "item_name" VARCHAR(100) NOT NULL,
  "unit_label" VARCHAR(30) NOT NULL,
  "included_quantity" INTEGER NOT NULL DEFAULT 0,
  "extra_quantity" INTEGER NOT NULL DEFAULT 0,
  "unit_price" DECIMAL(10, 2) NOT NULL,
  "line_total" DECIMAL(10, 2) NOT NULL,
  "image_url" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_cutlery_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cutlery_items_name_key" ON "cutlery_items"("name");
CREATE INDEX "cutlery_items_is_active_display_order_idx" ON "cutlery_items"("is_active", "display_order");
CREATE UNIQUE INDEX "cart_cutlery_items_cart_id_cutlery_item_id_key" ON "cart_cutlery_items"("cart_id", "cutlery_item_id");
CREATE INDEX "cart_cutlery_items_cart_id_idx" ON "cart_cutlery_items"("cart_id");
CREATE INDEX "cart_cutlery_items_cutlery_item_id_idx" ON "cart_cutlery_items"("cutlery_item_id");
CREATE INDEX "order_cutlery_items_order_id_idx" ON "order_cutlery_items"("order_id");
CREATE INDEX "order_cutlery_items_cutlery_item_id_idx" ON "order_cutlery_items"("cutlery_item_id");

ALTER TABLE "cart_cutlery_items" ADD CONSTRAINT "cart_cutlery_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_cutlery_items" ADD CONSTRAINT "cart_cutlery_items_cutlery_item_id_fkey" FOREIGN KEY ("cutlery_item_id") REFERENCES "cutlery_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_cutlery_items" ADD CONSTRAINT "order_cutlery_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_cutlery_items" ADD CONSTRAINT "order_cutlery_items_cutlery_item_id_fkey" FOREIGN KEY ("cutlery_item_id") REFERENCES "cutlery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "cutlery_items" ("id", "name", "extra_label", "description", "unit_label", "unit_price", "included_quantity", "image_url", "display_order") VALUES
  ('cutlery-serving-spoons', 'Serving Spoons', 'Serving Spoons', 'Stainless-steel serving spoons', 'piece', 20, 0, '/cutlery/serving-spoons.png', 10),
  ('cutlery-plates', 'Plates', 'Extra Plates', 'Natural disposable plates', 'piece', 10, 10, '/cutlery/plates.png', 20),
  ('cutlery-water-bottles', 'Water Bottles', 'Water Bottles', 'Individual drinking-water bottles', 'piece', 10, 0, '/cutlery/water-bottles.png', 30),
  ('cutlery-spoons-forks', 'Spoons & Forks', 'Extra Spoons & Forks', 'A spoon and fork set', 'set', 5, 10, '/cutlery/spoons-forks.png', 40),
  ('cutlery-tissues', 'Tissues', 'Extra Tissues', 'Soft paper tissues', 'pack', 5, 10, '/cutlery/tissues.png', 50);
