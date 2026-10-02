ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_APPROVAL';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

CREATE TYPE "PaymentStatus_new" AS ENUM (
  'UNPAID',
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'FAILED',
  'REFUND_PENDING',
  'REFUND_FAILED',
  'REFUNDED',
  'VOIDED'
);

ALTER TABLE "orders" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "orders"
  ALTER COLUMN "payment_status" TYPE "PaymentStatus_new"
  USING ("payment_status"::text::"PaymentStatus_new");
ALTER TABLE "payments"
  ALTER COLUMN "payment_status" TYPE "PaymentStatus_new"
  USING ("payment_status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";
ALTER TABLE "payments" ALTER COLUMN "payment_status" SET DEFAULT 'PENDING';

CREATE TYPE "PaymentPlan" AS ENUM ('FULL', 'HALF', 'PAY_LATER');
CREATE TYPE "PaymentSource" AS ENUM ('RAZORPAY', 'MANUAL');

ALTER TABLE "orders"
  ALTER COLUMN "payment_status" SET DEFAULT 'UNPAID',
  ADD COLUMN "payment_plan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
  ADD COLUMN "decline_reason" VARCHAR(500),
  ADD COLUMN "declined_at" TIMESTAMP(3);

UPDATE "orders"
SET "payment_status" = 'UNPAID'
WHERE "payment_status" IN ('PENDING', 'FAILED');

ALTER TABLE "payments"
  ADD COLUMN "source" "PaymentSource" NOT NULL DEFAULT 'RAZORPAY',
  ADD COLUMN "external_reference" VARCHAR(150),
  ADD COLUMN "notes" VARCHAR(500),
  ADD COLUMN "recorded_by_admin_id" TEXT,
  ADD COLUMN "voided_at" TIMESTAMP(3),
  ADD COLUMN "voided_by_admin_id" TEXT,
  ADD COLUMN "void_reason" VARCHAR(500);

ALTER TABLE "checkout_attempts"
  ADD COLUMN "payment_plan" "PaymentPlan" NOT NULL DEFAULT 'FULL';

CREATE INDEX "payments_recorded_by_admin_id_idx"
  ON "payments"("recorded_by_admin_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_recorded_by_admin_id_fkey"
  FOREIGN KEY ("recorded_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_voided_by_admin_id_fkey"
  FOREIGN KEY ("voided_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
