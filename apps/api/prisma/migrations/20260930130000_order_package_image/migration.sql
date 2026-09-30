ALTER TABLE "orders"
  ADD COLUMN "package_image_url" VARCHAR(500);

UPDATE "orders" AS "order"
SET "package_image_url" = "package"."image_url"
FROM "packages" AS "package"
WHERE "package"."name" = "order"."package_name"
  AND "package"."image_url" IS NOT NULL;
