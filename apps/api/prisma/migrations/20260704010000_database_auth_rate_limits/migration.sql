CREATE TABLE "auth_rate_limits" (
  "key_hash" CHAR(64) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("key_hash")
);

CREATE INDEX "auth_rate_limits_expires_at_idx"
  ON "auth_rate_limits"("expires_at");
