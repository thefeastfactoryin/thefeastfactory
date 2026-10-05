-- Operational notes and financial documents describe the booking as a whole.
-- Existing order-level records are intentionally discarded: production has only
-- a handful of disposable pre-booking records and preserving dual ownership
-- would leave an ambiguous source of truth.
DROP TABLE IF EXISTS "order_documents";
DROP TABLE IF EXISTS "order_notes";

CREATE TABLE "booking_notes" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_documents" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "refund_id" TEXT,
    "document_type" "DocumentType" NOT NULL,
    "document_number" VARCHAR(50) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_notes_booking_id_created_at_idx" ON "booking_notes"("booking_id", "created_at");
CREATE UNIQUE INDEX "booking_documents_document_number_key" ON "booking_documents"("document_number");
CREATE INDEX "booking_documents_booking_id_document_type_idx" ON "booking_documents"("booking_id", "document_type");
CREATE INDEX "booking_documents_user_id_generated_at_idx" ON "booking_documents"("user_id", "generated_at");
CREATE INDEX "booking_documents_payment_id_idx" ON "booking_documents"("payment_id");
CREATE INDEX "booking_documents_refund_id_idx" ON "booking_documents"("refund_id");

ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
