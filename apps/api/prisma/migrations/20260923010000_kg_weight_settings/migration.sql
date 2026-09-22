ALTER TABLE package_versions
  ADD COLUMN kg_default_weight_grams INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN kg_weight_increment_grams INTEGER NOT NULL DEFAULT 500;

ALTER TABLE package_versions
  ADD CONSTRAINT package_versions_kg_weight_settings_check CHECK (
    kg_default_weight_grams BETWEEN 500 AND 100000
    AND kg_default_weight_grams % 500 = 0
    AND kg_weight_increment_grams BETWEEN 500 AND 100000
    AND kg_weight_increment_grams % 500 = 0
  );
