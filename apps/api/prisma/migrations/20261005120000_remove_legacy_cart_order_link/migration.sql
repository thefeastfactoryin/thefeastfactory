-- Carts are mutable checkout drafts. Orders are immutable booking children and
-- retain only source_cart_id as provenance; they must not own or preserve carts.
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_cart_id_fkey";

DROP INDEX IF EXISTS "orders_cart_id_key";

ALTER TABLE "orders" DROP COLUMN IF EXISTS "cart_id";
