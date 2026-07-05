-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('HOME', 'OFFICE', 'EVENT_VENUE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CancellationActor" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_CONFIRMED', 'ORDER_IN_PROGRESS', 'ORDER_READY', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'PAYMENT_FAILED', 'REFUND_UPDATED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PAYMENT_RECEIPT', 'GST_INVOICE', 'REFUND_CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('MEAL_BOX', 'FIXED_PACKAGE', 'CUSTOM_PACKAGE');

-- CreateEnum
CREATE TYPE "PackageMenuItemRole" AS ENUM ('INCLUDED', 'EXTRA', 'CUSTOM_SELECTABLE');

-- CreateEnum
CREATE TYPE "SelectedItemRole" AS ENUM ('INCLUDED', 'SWAP', 'EXTRA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "mobile_number" VARCHAR(15) NOT NULL,
    "name" VARCHAR(100),
    "email" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "address_type" "AddressType" NOT NULL DEFAULT 'HOME',
    "label" VARCHAR(50),
    "address_line1" VARCHAR(255) NOT NULL,
    "address_line2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "landmark" VARCHAR(255),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(1000),
    "box_price" DECIMAL(10,2) NOT NULL,
    "general_price" DECIMAL(10,2) NOT NULL,
    "is_veg" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "type" "PackageType" NOT NULL DEFAULT 'FIXED_PACKAGE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_versions" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "base_price_per_plate" DECIMAL(10,2) NOT NULL,
    "min_guest_count" INTEGER NOT NULL DEFAULT 10,
    "max_guest_count" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_menu_items" (
    "id" TEXT NOT NULL,
    "package_version_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "role" "PackageMenuItemRole" NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_swappable" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "package_version_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "region_id" TEXT,
    "event_name" VARCHAR(200),
    "event_date" DATE NOT NULL,
    "event_time_start" TIME,
    "guest_count" INTEGER NOT NULL,
    "distance_km" DECIMAL(8,2),
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "special_notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "package_version_id" TEXT NOT NULL,
    "event_id" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "last_quoted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "replaced_menu_item_id" TEXT,
    "role" "SelectedItemRole" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" VARCHAR(20) NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "cart_id" TEXT,
    "region_id" TEXT,
    "guest_count" INTEGER NOT NULL,
    "base_per_plate_price" DECIMAL(10,2) NOT NULL,
    "total_customization_charges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "final_per_plate_price" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "distance_km" DECIMAL(8,2),
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "package_name" VARCHAR(100) NOT NULL,
    "package_version_no" INTEGER NOT NULL,
    "order_status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" "CancellationActor",
    "cancellation_reason" VARCHAR(500),
    "cancelled_by_admin_id" TEXT,
    "booking_lead_hours" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_selected_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "replaced_menu_item_id" TEXT,
    "role" "SelectedItemRole" NOT NULL,
    "menu_item_name" VARCHAR(150) NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "replaced_menu_item_name" VARCHAR(150),
    "is_veg" BOOLEAN NOT NULL,
    "item_price" DECIMAL(10,2) NOT NULL,
    "included_value" DECIMAL(10,2) NOT NULL,
    "adjustment_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_selected_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "razorpay_order_id" VARCHAR(100),
    "razorpay_payment_id" VARCHAR(100),
    "razorpay_signature" VARCHAR(500),
    "gateway_response" JSONB,
    "payment_method" VARCHAR(50),
    "paid_at" TIMESTAMP(3),
    "failure_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "refund_status" "RefundStatus" NOT NULL DEFAULT 'INITIATED',
    "razorpay_refund_id" VARCHAR(100),
    "reason" VARCHAR(500),
    "initiated_by_id" TEXT,
    "gateway_response" JSONB,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "AdminRole" NOT NULL,
    "region_id" TEXT,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_regions" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "center_latitude" DECIMAL(10,8) NOT NULL,
    "center_longitude" DECIMAL(11,8) NOT NULL,
    "service_radius_km" DECIMAL(8,2) NOT NULL DEFAULT 50,
    "delivery_fee_per_km" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operating_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "changed_by_id" TEXT,
    "notes" VARCHAR(500),
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "provider_event_id" VARCHAR(150) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "processing_error" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_documents" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "refund_id" TEXT,
    "document_type" "DocumentType" NOT NULL,
    "document_number" VARCHAR(50) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "mobile_number" VARCHAR(15) NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_number_key" ON "users"("mobile_number");

-- CreateIndex
CREATE INDEX "users_mobile_number_idx" ON "users"("mobile_number");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses"("user_id");

-- CreateIndex
CREATE INDEX "user_addresses_user_id_is_default_idx" ON "user_addresses"("user_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_name_key" ON "menu_categories"("name");

-- CreateIndex
CREATE INDEX "menu_categories_is_active_idx" ON "menu_categories"("is_active");

-- CreateIndex
CREATE INDEX "menu_items_category_id_idx" ON "menu_items"("category_id");

-- CreateIndex
CREATE INDEX "menu_items_is_active_idx" ON "menu_items"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_category_id_name_key" ON "menu_items"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "packages_name_key" ON "packages"("name");

-- CreateIndex
CREATE INDEX "packages_type_idx" ON "packages"("type");

-- CreateIndex
CREATE INDEX "packages_is_active_idx" ON "packages"("is_active");

-- CreateIndex
CREATE INDEX "package_versions_package_id_is_active_idx" ON "package_versions"("package_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "package_versions_package_id_version_no_key" ON "package_versions"("package_id", "version_no");

-- CreateIndex
CREATE INDEX "package_menu_items_package_version_id_role_idx" ON "package_menu_items"("package_version_id", "role");

-- CreateIndex
CREATE INDEX "package_menu_items_package_version_id_category_id_idx" ON "package_menu_items"("package_version_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_menu_items_package_version_id_menu_item_id_role_key" ON "package_menu_items"("package_version_id", "menu_item_id", "role");

-- CreateIndex
CREATE INDEX "events_user_id_idx" ON "events"("user_id");

-- CreateIndex
CREATE INDEX "events_event_date_status_idx" ON "events"("event_date", "status");

-- CreateIndex
CREATE INDEX "events_region_id_event_date_idx" ON "events"("region_id", "event_date");

-- CreateIndex
CREATE INDEX "events_user_id_event_date_idx" ON "events"("user_id", "event_date");

-- CreateIndex
CREATE INDEX "carts_user_id_status_idx" ON "carts"("user_id", "status");

-- CreateIndex
CREATE INDEX "carts_package_version_id_idx" ON "carts"("package_version_id");

-- CreateIndex
CREATE INDEX "carts_event_id_idx" ON "carts"("event_id");

-- CreateIndex
CREATE INDEX "carts_expires_at_idx" ON "carts"("expires_at");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_role_idx" ON "cart_items"("cart_id", "role");

-- CreateIndex
CREATE INDEX "cart_items_category_id_idx" ON "cart_items"("category_id");

-- CreateIndex
CREATE INDEX "cart_items_menu_item_id_idx" ON "cart_items"("menu_item_id");

-- CreateIndex
CREATE INDEX "cart_items_replaced_menu_item_id_idx" ON "cart_items"("replaced_menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_cart_id_key" ON "orders"("cart_id");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_event_id_idx" ON "orders"("event_id");

-- CreateIndex
CREATE INDEX "orders_order_status_idx" ON "orders"("order_status");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_region_id_order_status_idx" ON "orders"("region_id", "order_status");

-- CreateIndex
CREATE INDEX "orders_region_id_created_at_idx" ON "orders"("region_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "order_selected_items_order_id_idx" ON "order_selected_items"("order_id");

-- CreateIndex
CREATE INDEX "order_selected_items_order_id_category_id_idx" ON "order_selected_items"("order_id", "category_id");

-- CreateIndex
CREATE INDEX "order_selected_items_role_idx" ON "order_selected_items"("role");

-- CreateIndex
CREATE INDEX "order_selected_items_menu_item_id_idx" ON "order_selected_items"("menu_item_id");

-- CreateIndex
CREATE INDEX "order_selected_items_replaced_menu_item_id_idx" ON "order_selected_items"("replaced_menu_item_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

-- CreateIndex
CREATE INDEX "payments_razorpay_order_id_idx" ON "payments"("razorpay_order_id");

-- CreateIndex
CREATE INDEX "payments_razorpay_payment_id_idx" ON "payments"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_refund_status_idx" ON "refunds"("refund_status");

-- CreateIndex
CREATE INDEX "refunds_razorpay_refund_id_idx" ON "refunds"("razorpay_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_is_active_idx" ON "admin_users"("is_active");

-- CreateIndex
CREATE INDEX "admin_users_region_id_idx" ON "admin_users"("region_id");

-- CreateIndex
CREATE UNIQUE INDEX "operating_regions_code_key" ON "operating_regions"("code");

-- CreateIndex
CREATE INDEX "operating_regions_is_active_idx" ON "operating_regions"("is_active");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_changed_at_idx" ON "order_status_history"("order_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_event_type_idx" ON "payment_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processed_at_idx" ON "payment_webhook_events"("processed_at");

-- CreateIndex
CREATE INDEX "order_notes_order_id_created_at_idx" ON "order_notes"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_order_id_idx" ON "notifications"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_documents_document_number_key" ON "order_documents"("document_number");

-- CreateIndex
CREATE INDEX "order_documents_order_id_document_type_idx" ON "order_documents"("order_id", "document_type");

-- CreateIndex
CREATE INDEX "order_documents_user_id_generated_at_idx" ON "order_documents"("user_id", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- CreateIndex
CREATE INDEX "otp_verifications_mobile_number_is_verified_idx" ON "otp_verifications"("mobile_number", "is_verified");

-- CreateIndex
CREATE INDEX "otp_verifications_expires_at_idx" ON "otp_verifications"("expires_at");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_versions" ADD CONSTRAINT "package_versions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_menu_items" ADD CONSTRAINT "package_menu_items_package_version_id_fkey" FOREIGN KEY ("package_version_id") REFERENCES "package_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_menu_items" ADD CONSTRAINT "package_menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_menu_items" ADD CONSTRAINT "package_menu_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_package_version_id_fkey" FOREIGN KEY ("package_version_id") REFERENCES "package_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "user_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "operating_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_package_version_id_fkey" FOREIGN KEY ("package_version_id") REFERENCES "package_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_replaced_menu_item_id_fkey" FOREIGN KEY ("replaced_menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "operating_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_admin_id_fkey" FOREIGN KEY ("cancelled_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_selected_items" ADD CONSTRAINT "order_selected_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_selected_items" ADD CONSTRAINT "order_selected_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_selected_items" ADD CONSTRAINT "order_selected_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_selected_items" ADD CONSTRAINT "order_selected_items_replaced_menu_item_id_fkey" FOREIGN KEY ("replaced_menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "operating_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
