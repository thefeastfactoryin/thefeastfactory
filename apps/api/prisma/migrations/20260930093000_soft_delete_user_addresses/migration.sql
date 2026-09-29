ALTER TABLE "user_addresses"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "user_addresses_deleted_at_idx"
  ON "user_addresses"("deleted_at");
