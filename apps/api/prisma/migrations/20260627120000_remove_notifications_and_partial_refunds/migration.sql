-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
ALTER TABLE "public"."orders" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "public"."payments" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "payment_status" TYPE "PaymentStatus_new" USING ("payment_status"::text::"PaymentStatus_new");
ALTER TABLE "payments" ALTER COLUMN "payment_status" TYPE "PaymentStatus_new" USING ("payment_status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'PENDING';
ALTER TABLE "payments" ALTER COLUMN "payment_status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_order_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropTable
DROP TABLE "notifications";

-- DropEnum
DROP TYPE "NotificationType";
