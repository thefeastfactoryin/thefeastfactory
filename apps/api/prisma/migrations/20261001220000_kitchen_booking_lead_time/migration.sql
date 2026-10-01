ALTER TABLE "operating_regions"
ADD COLUMN "min_booking_lead_hours" INTEGER NOT NULL DEFAULT 48;

UPDATE "operating_regions"
SET "min_booking_lead_hours" = COALESCE(
  (
    SELECT CASE
      WHEN "value" ~ '^[0-9]+$' THEN "value"::INTEGER
      ELSE NULL
    END
    FROM "platform_settings"
    WHERE "key" = 'min_booking_lead_hours'
  ),
  48
);

ALTER TABLE "operating_regions"
ADD CONSTRAINT "operating_regions_min_booking_lead_hours_check"
CHECK ("min_booking_lead_hours" >= 0);

DELETE FROM "platform_settings"
WHERE "key" = 'min_booking_lead_hours';
