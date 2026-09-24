-- UAT and production deployments run `prisma migrate deploy` without running
-- the development seed. Ensure Khammam is present there as an enabled kitchen.
-- Existing rows are deliberately preserved so admin-managed availability,
-- service radius, delivery pricing, and public details are never reset.
INSERT INTO "operating_regions" (
  "id",
  "code",
  "name",
  "kitchen_address",
  "fssai_license_no",
  "kitchen_image_url",
  "map_url",
  "public_display_order",
  "center_latitude",
  "center_longitude",
  "service_radius_km",
  "delivery_fee_per_km",
  "is_active",
  "is_accepting_orders",
  "created_at",
  "updated_at"
)
VALUES (
  '2d093418-03bd-4f84-9acd-8fbaec6e5019',
  'KHAMMAM',
  'Khammam',
  'H.No. 11-65/2, Autonagar, Near R&B Guest House, Wyra Road, Khammam, Telangana - 507 002',
  NULL,
  '/office-hero.png',
  'https://www.google.com/maps?q=17.24730000,80.15140000',
  4,
  17.24730000,
  80.15140000,
  50.00,
  10.00,
  TRUE,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
