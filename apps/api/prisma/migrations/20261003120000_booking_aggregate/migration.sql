-- Introduce booking and cart-session aggregate roots without removing legacy
-- cart/order columns. Existing records are backfilled before foreign keys are
-- enforced so this migration can be deployed ahead of the application switch.

CREATE TYPE "BookingStatus" AS ENUM (
  'PENDING_PAYMENT',
  'AWAITING_APPROVAL',
  'CONFIRMED',
  'DECLINED',
  'CANCELLED',
  'COMPLETED',
  'NEEDS_REVIEW'
);

CREATE TABLE "cart_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "address_id" TEXT,
  "region_id" TEXT,
  "event_name" VARCHAR(200),
  "event_date" DATE,
  "event_time_start" TIME,
  "distance_km" DECIMAL(8,2),
  "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "delivery_service_type" "DeliveryServiceType" NOT NULL DEFAULT 'STANDARD',
  "helper_count" INTEGER NOT NULL DEFAULT 0,
  "contact_number" VARCHAR(10) NOT NULL,
  "special_notes" VARCHAR(1000),
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cart_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "booking_number" VARCHAR(24) NOT NULL,
  "user_id" TEXT NOT NULL,
  "cart_session_id" TEXT,
  "source_checkout_batch_id" UUID,
  "region_id" TEXT,
  "address_id" TEXT,
  "address_label" VARCHAR(50),
  "address_line1" VARCHAR(255) NOT NULL,
  "address_line2" VARCHAR(255),
  "city" VARCHAR(100) NOT NULL,
  "state" VARCHAR(100) NOT NULL,
  "pincode" VARCHAR(10) NOT NULL,
  "landmark" VARCHAR(255),
  "latitude" DECIMAL(10,8),
  "longitude" DECIMAL(11,8),
  "event_name" VARCHAR(200),
  "event_date" DATE NOT NULL,
  "event_time_start" TIME,
  "contact_number" VARCHAR(10) NOT NULL,
  "special_notes" VARCHAR(1000),
  "distance_km" DECIMAL(8,2),
  "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "delivery_service_type" "DeliveryServiceType" NOT NULL DEFAULT 'STANDARD',
  "helper_count" INTEGER NOT NULL DEFAULT 0,
  "items_subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "cutlery_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(10,2) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'AWAITING_APPROVAL',
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "payment_plan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
  "decline_reason" VARCHAR(500),
  "declined_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "cancelled_by" "CancellationActor",
  "cancellation_reason" VARCHAR(500),
  "migration_needs_review" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_cutlery_items" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "cutlery_item_id" TEXT,
  "item_name" VARCHAR(100) NOT NULL,
  "unit_label" VARCHAR(30) NOT NULL,
  "included_quantity" INTEGER NOT NULL DEFAULT 0,
  "extra_quantity" INTEGER NOT NULL DEFAULT 0,
  "unit_price" DECIMAL(10,2) NOT NULL,
  "line_total" DECIMAL(10,2) NOT NULL,
  "image_url" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_cutlery_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_status_history" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "from_status" "BookingStatus",
  "to_status" "BookingStatus" NOT NULL,
  "changed_by_id" TEXT,
  "notes" VARCHAR(500),
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_allocations" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "carts" ADD COLUMN "cart_session_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "booking_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "booking_id" TEXT;
ALTER TABLE "checkout_attempts" ADD COLUMN "booking_id" TEXT;

-- One active cart session is reconstructed per customer. Active carts already
-- behave as one checkout batch in the existing application.
INSERT INTO "cart_sessions" (
  "id", "user_id", "address_id", "region_id", "event_name", "event_date",
  "event_time_start", "distance_km", "delivery_fee", "delivery_service_type",
  "helper_count", "contact_number", "special_notes", "status", "expires_at",
  "created_at", "updated_at"
)
SELECT DISTINCT ON (c."user_id")
  c."id", c."user_id", c."address_id", c."region_id", c."event_name",
  c."event_date", c."event_time_start", c."distance_km", c."delivery_fee",
  c."delivery_service_type", c."helper_count", c."contact_number",
  c."special_notes", 'ACTIVE'::"CartStatus", c."expires_at", c."created_at",
  c."updated_at"
FROM "carts" c
WHERE c."status" = 'ACTIVE'
ORDER BY c."user_id", c."updated_at" DESC, c."id";

UPDATE "carts" c
SET "cart_session_id" = s."id"
FROM "cart_sessions" s
WHERE c."user_id" = s."user_id" AND c."status" = 'ACTIVE';

-- Backfill one booking for each historical checkout batch. Standalone orders
-- use their own order id as the stable booking id.
WITH ranked AS (
  SELECT
    o.*,
    COALESCE(o."checkout_batch_id"::text, o."id") AS aggregate_id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(o."checkout_batch_id"::text, o."id")
      ORDER BY o."created_at", o."id"
    ) AS row_no
  FROM "orders" o
), aggregate_values AS (
  SELECT
    r."aggregate_id",
    MIN(r."created_at") AS created_at,
    MAX(r."updated_at") AS updated_at,
    SUM(r."total_amount") AS total_amount,
    SUM(r."delivery_fee") AS delivery_fee,
    SUM(r."cutlery_total") AS cutlery_total,
    SUM(r."total_amount" - r."delivery_fee" - r."cutlery_total") AS items_subtotal,
    COUNT(DISTINCT r."user_id") AS users,
    COUNT(DISTINCT COALESCE(r."address_id", '')) AS addresses,
    COUNT(DISTINCT COALESCE(r."region_id", '')) AS regions,
    COUNT(DISTINCT r."event_date") AS event_dates,
    COUNT(DISTINCT COALESCE(r."event_time_start"::text, '')) AS event_times,
    COUNT(DISTINCT r."delivery_service_type") AS delivery_services,
    COUNT(DISTINCT r."order_status") AS order_statuses,
    COUNT(DISTINCT r."payment_status") AS payment_statuses,
    COUNT(DISTINCT r."payment_plan") AS payment_plans
  FROM ranked r
  GROUP BY r."aggregate_id"
)
INSERT INTO "bookings" (
  "id", "booking_number", "user_id", "source_checkout_batch_id", "region_id",
  "address_id", "address_label", "address_line1", "address_line2", "city",
  "state", "pincode", "landmark", "latitude", "longitude", "event_name",
  "event_date", "event_time_start", "contact_number", "special_notes",
  "distance_km", "delivery_fee", "delivery_service_type", "helper_count",
  "items_subtotal", "cutlery_total", "total_amount", "status",
  "payment_status", "payment_plan", "decline_reason", "declined_at",
  "cancelled_at", "cancelled_by", "cancellation_reason",
  "migration_needs_review", "created_at", "updated_at"
)
SELECT
  r."aggregate_id",
  'BKG-' || UPPER(SUBSTRING(REPLACE(r."aggregate_id", '-', '') FROM 1 FOR 16)),
  r."user_id",
  r."checkout_batch_id",
  r."region_id",
  r."address_id",
  COALESCE(a."label", a."address_type"::text),
  a."address_line1",
  a."address_line2",
  a."city",
  a."state",
  a."pincode",
  a."landmark",
  a."latitude",
  a."longitude",
  r."event_name",
  r."event_date",
  r."event_time_start",
  r."contact_number",
  r."special_notes",
  r."distance_km",
  av."delivery_fee",
  r."delivery_service_type",
  r."helper_count",
  av."items_subtotal",
  av."cutlery_total",
  av."total_amount",
  CASE
    WHEN av."order_statuses" > 1 THEN 'NEEDS_REVIEW'::"BookingStatus"
    WHEN r."order_status" IN ('DRAFT', 'PENDING_PAYMENT') THEN 'PENDING_PAYMENT'::"BookingStatus"
    WHEN r."order_status" = 'AWAITING_APPROVAL' THEN 'AWAITING_APPROVAL'::"BookingStatus"
    WHEN r."order_status" = 'DECLINED' THEN 'DECLINED'::"BookingStatus"
    WHEN r."order_status" = 'CANCELLED' THEN 'CANCELLED'::"BookingStatus"
    WHEN r."order_status" = 'DELIVERED' THEN 'COMPLETED'::"BookingStatus"
    ELSE 'CONFIRMED'::"BookingStatus"
  END,
  CASE
    WHEN av."payment_statuses" = 1 THEN r."payment_status"
    ELSE 'PARTIALLY_PAID'::"PaymentStatus"
  END,
  r."payment_plan",
  r."decline_reason",
  r."declined_at",
  r."cancelled_at",
  r."cancelled_by",
  r."cancellation_reason",
  (
    av."users" > 1 OR av."addresses" > 1 OR av."regions" > 1 OR
    av."event_dates" > 1 OR av."event_times" > 1 OR
    av."delivery_services" > 1 OR av."order_statuses" > 1 OR
    av."payment_statuses" > 1 OR av."payment_plans" > 1
  ),
  av."created_at",
  av."updated_at"
FROM ranked r
JOIN aggregate_values av ON av."aggregate_id" = r."aggregate_id"
JOIN "user_addresses" a ON a."id" = r."address_id"
WHERE r."row_no" = 1;

UPDATE "orders"
SET "booking_id" = COALESCE("checkout_batch_id"::text, "id");

UPDATE "payments" p
SET "booking_id" = o."booking_id"
FROM "orders" o
WHERE p."order_id" = o."id";

INSERT INTO "payment_allocations" (
  "id", "payment_id", "order_id", "amount", "created_at"
)
SELECT p."id" || ':' || p."order_id", p."id", p."order_id", p."amount", p."created_at"
FROM "payments" p;

-- Copy the booking-level cutlery snapshot from the order that owns the shared
-- charge. Legacy batches intentionally charged shared cutlery on one order.
INSERT INTO "booking_cutlery_items" (
  "id", "booking_id", "cutlery_item_id", "item_name", "unit_label",
  "included_quantity", "extra_quantity", "unit_price", "line_total",
  "image_url", "created_at"
)
SELECT
  b."id" || ':' || oci."id",
  b."id",
  oci."cutlery_item_id",
  oci."item_name",
  oci."unit_label",
  oci."included_quantity",
  oci."extra_quantity",
  oci."unit_price",
  oci."line_total",
  oci."image_url",
  oci."created_at"
FROM "bookings" b
JOIN "orders" o ON o."booking_id" = b."id"
JOIN "order_cutlery_items" oci ON oci."order_id" = o."id"
WHERE o."cutlery_total" > 0;

CREATE UNIQUE INDEX "bookings_booking_number_key" ON "bookings"("booking_number");
CREATE UNIQUE INDEX "bookings_cart_session_id_key" ON "bookings"("cart_session_id");
CREATE INDEX "cart_sessions_user_id_status_idx" ON "cart_sessions"("user_id", "status");
CREATE INDEX "cart_sessions_address_id_idx" ON "cart_sessions"("address_id");
CREATE INDEX "cart_sessions_region_id_event_date_idx" ON "cart_sessions"("region_id", "event_date");
CREATE INDEX "cart_sessions_expires_at_idx" ON "cart_sessions"("expires_at");
CREATE UNIQUE INDEX "cart_sessions_one_active_per_user" ON "cart_sessions"("user_id") WHERE "status" = 'ACTIVE';
CREATE INDEX "carts_cart_session_id_idx" ON "carts"("cart_session_id");
CREATE INDEX "bookings_user_id_created_at_idx" ON "bookings"("user_id", "created_at");
CREATE INDEX "bookings_region_id_status_idx" ON "bookings"("region_id", "status");
CREATE INDEX "bookings_event_date_idx" ON "bookings"("event_date");
CREATE INDEX "bookings_payment_status_idx" ON "bookings"("payment_status");
CREATE INDEX "bookings_source_checkout_batch_id_idx" ON "bookings"("source_checkout_batch_id");
CREATE INDEX "booking_cutlery_items_booking_id_idx" ON "booking_cutlery_items"("booking_id");
CREATE INDEX "booking_cutlery_items_cutlery_item_id_idx" ON "booking_cutlery_items"("cutlery_item_id");
CREATE INDEX "booking_status_history_booking_id_changed_at_idx" ON "booking_status_history"("booking_id", "changed_at");
CREATE INDEX "orders_booking_id_idx" ON "orders"("booking_id");
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");
CREATE UNIQUE INDEX "payment_allocations_payment_id_order_id_key" ON "payment_allocations"("payment_id", "order_id");
CREATE INDEX "payment_allocations_order_id_idx" ON "payment_allocations"("order_id");

ALTER TABLE "cart_sessions" ADD CONSTRAINT "cart_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cart_sessions" ADD CONSTRAINT "cart_sessions_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_sessions" ADD CONSTRAINT "cart_sessions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "operating_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_cart_session_id_fkey" FOREIGN KEY ("cart_session_id") REFERENCES "cart_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cart_session_id_fkey" FOREIGN KEY ("cart_session_id") REFERENCES "cart_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "operating_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_cutlery_items" ADD CONSTRAINT "booking_cutlery_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_cutlery_items" ADD CONSTRAINT "booking_cutlery_items_cutlery_item_id_fkey" FOREIGN KEY ("cutlery_item_id") REFERENCES "cutlery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
