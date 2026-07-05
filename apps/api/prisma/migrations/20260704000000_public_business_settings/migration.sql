INSERT INTO "platform_settings" ("id", "key", "value", "description", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000104', 'business_legal_name', '', 'Legal business name shown on customer and order documents.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000105', 'business_trade_name', '', 'Public trading name shown to customers.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000106', 'business_address', '', 'Public business or support address.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000107', 'business_gstin', '', 'GST registration number used on tax documents.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000108', 'business_support_email', '', 'Customer support email address.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000109', 'business_support_phone', '', 'Customer support phone number.', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
