ALTER TABLE "orders"
ADD COLUMN "checkout_batch_id" UUID;

CREATE INDEX "orders_checkout_batch_id_idx"
ON "orders"("checkout_batch_id");
