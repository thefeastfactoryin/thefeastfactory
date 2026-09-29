ALTER TABLE "carts"
ADD COLUMN "payment_try_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orders"
ADD COLUMN "source_cart_id" TEXT;

UPDATE "orders" SET "source_cart_id" = "cart_id" WHERE "cart_id" IS NOT NULL;

CREATE UNIQUE INDEX "orders_source_cart_id_key" ON "orders"("source_cart_id");

CREATE TYPE "CheckoutAttemptStatus" AS ENUM ('PENDING', 'FAILED', 'PROCESSING', 'PAID', 'NEEDS_REVIEW');

CREATE TABLE "checkout_attempts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "razorpay_order_id" VARCHAR(100) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "CheckoutAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "snapshot" JSONB NOT NULL,
  "razorpay_payment_id" VARCHAR(100),
  "order_ids" JSONB,
  "failure_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkout_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checkout_attempts_razorpay_order_id_key"
ON "checkout_attempts"("razorpay_order_id");

CREATE INDEX "checkout_attempts_user_id_created_at_idx"
ON "checkout_attempts"("user_id", "created_at");

CREATE INDEX "checkout_attempts_status_created_at_idx"
ON "checkout_attempts"("status", "created_at");

ALTER TABLE "checkout_attempts"
ADD CONSTRAINT "checkout_attempts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
