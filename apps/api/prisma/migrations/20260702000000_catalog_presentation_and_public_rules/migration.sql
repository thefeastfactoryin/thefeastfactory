ALTER TABLE "packages"
  ADD COLUMN "image_url" VARCHAR(500),
  ADD COLUMN "badge_label" VARCHAR(100);

ALTER TABLE "ordering_offerings"
  ADD COLUMN "image_url" VARCHAR(500),
  ADD COLUMN "cta_label" VARCHAR(100);

UPDATE "packages"
SET "image_url" = CASE "name"
    WHEN 'Pooja Package' THEN '/pkg-puja.png'
    WHEN 'Farm House Celebration' THEN '/pkg-farmhouse.png'
    WHEN 'Corporate Gathering' THEN '/pkg-corporate.png'
    WHEN '3 Item Veg Meal Box' THEN '/tray-3.png'
    WHEN '3 Item Non-Veg Meal Box' THEN '/tray-3.png'
    WHEN '5 Item Veg Meal Box' THEN '/tray-5.png'
    WHEN '5 Item Non-Veg Meal Box' THEN '/tray-5.png'
    WHEN '8 Item Veg Meal Box' THEN '/tray-8.png'
    WHEN '8 Item Non-Veg Meal Box' THEN '/tray-8.png'
    WHEN 'Custom Menu' THEN '/order-build.png'
    ELSE NULL
  END
WHERE "image_url" IS NULL;

UPDATE "packages"
SET "badge_label" = 'Most popular'
WHERE "name" = 'Pooja Package' AND "badge_label" IS NULL;

UPDATE "ordering_offerings"
SET "image_url" = CASE "code"
    WHEN 'MEAL_BOX' THEN '/order-mealbox.png'
    WHEN 'PACKAGES' THEN '/order-occasion.png'
    WHEN 'CUSTOM_MENU' THEN '/order-build.png'
    ELSE NULL
  END
WHERE "image_url" IS NULL;

UPDATE "ordering_offerings"
SET "cta_label" = CASE "code"
    WHEN 'MEAL_BOX' THEN 'Explore meal boxes'
    WHEN 'PACKAGES' THEN 'View packages'
    WHEN 'CUSTOM_MENU' THEN 'Build your menu'
    ELSE NULL
  END
WHERE "cta_label" IS NULL;

INSERT INTO "platform_settings" ("id", "key", "value", "description", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000101', 'event_service_start_time', '06:00', 'Earliest selectable event service time.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000102', 'event_service_end_time', '23:30', 'Latest selectable event service time.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000103', 'event_time_interval_minutes', '30', 'Interval between selectable event service times.', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
