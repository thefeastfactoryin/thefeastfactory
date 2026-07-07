INSERT INTO "platform_settings" ("id", "key", "value", "description", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000110', 'business_state_code', '', 'GST state code used on tax documents.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000111', 'business_pan', '', 'Business PAN used on tax documents.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000112', 'business_logo_url', '', 'Business logo used on generated documents.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000113', 'invoice_prefix', 'INV', 'Prefix used for GST invoice numbers.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000114', 'receipt_prefix', 'RCT', 'Prefix used for payment receipt numbers.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000115', 'credit_note_prefix', 'CRN', 'Prefix used for refund credit-note numbers.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000116', 'tax_cgst_rate', '0', 'CGST percentage used on GST invoices.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000117', 'tax_sgst_rate', '0', 'SGST percentage used on GST invoices.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000118', 'tax_igst_rate', '0', 'IGST percentage used on GST invoices.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000119', 'tax_sac_code', '', 'SAC code used on GST invoices.', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000120', 'invoice_legal_footer', '', 'Legal footer printed on invoices and receipts.', NOW(), NOW())
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";
