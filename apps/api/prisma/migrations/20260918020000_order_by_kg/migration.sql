ALTER TABLE menu_items ADD COLUMN price_per_kg DECIMAL(10,2);
ALTER TABLE menu_items ADD CONSTRAINT menu_items_positive_kg_price CHECK (price_per_kg IS NULL OR price_per_kg > 0);
ALTER TABLE cart_items ADD COLUMN weight_grams INTEGER;
ALTER TABLE cart_items ADD CONSTRAINT cart_items_kg_weight CHECK (weight_grams IS NULL OR (weight_grams BETWEEN 500 AND 100000 AND weight_grams % 500 = 0 AND quantity = 1 AND role = 'CUSTOM' AND replaced_menu_item_id IS NULL));
ALTER TABLE order_selected_items ADD COLUMN weight_grams INTEGER, ADD COLUMN price_per_kg DECIMAL(10,2), ADD COLUMN line_total DECIMAL(10,2);
ALTER TABLE order_selected_items ADD CONSTRAINT order_items_kg_snapshot CHECK (
  (weight_grams IS NULL AND price_per_kg IS NULL AND line_total IS NULL) OR
  (weight_grams IS NOT NULL AND price_per_kg IS NOT NULL AND line_total IS NOT NULL AND weight_grams BETWEEN 500 AND 100000 AND weight_grams % 500 = 0 AND price_per_kg > 0 AND line_total = round(price_per_kg * weight_grams / 1000, 2) AND quantity = 1 AND role = 'CUSTOM' AND replaced_menu_item_id IS NULL)
);
ALTER TABLE orders ADD COLUMN package_type "PackageType";
UPDATE orders o SET package_type = p.type FROM carts c JOIN package_versions v ON v.id = c.package_version_id JOIN packages p ON p.id = v.package_id WHERE o.cart_id = c.id;
ALTER TABLE orders ALTER COLUMN guest_count DROP NOT NULL, ALTER COLUMN base_per_plate_price DROP NOT NULL, ALTER COLUMN total_customization_charges DROP NOT NULL, ALTER COLUMN final_per_plate_price DROP NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_kg_pricing CHECK (
  (package_type = 'ORDER_BY_KG' AND guest_count IS NULL AND base_per_plate_price IS NULL AND total_customization_charges IS NULL AND final_per_plate_price IS NULL) OR
  (package_type IS DISTINCT FROM 'ORDER_BY_KG' AND guest_count IS NOT NULL AND base_per_plate_price IS NOT NULL AND total_customization_charges IS NOT NULL AND final_per_plate_price IS NOT NULL)
);
INSERT INTO ordering_offerings (id,code,title,description,image_url,cta_label,display_order,is_active,created_at,updated_at)
VALUES ('6b01c3ef-ec3a-4b80-8b35-20a22c299b01','ORDER_BY_KG','Order by KG','Choose your favourite dishes and order by the kilo. Freshly prepared for sharing.','/menu-images/biryani/chicken-biryani/large.jpg','Explore food by KG',2,true,NOW(),NOW());
-- Draft only: operators choose eligible dishes and real prices before publishing.
INSERT INTO packages (id,name,description,type,is_active,display_order,is_featured,created_at,updated_at)
VALUES ('6b01c3ef-ec3a-4b80-8b35-20a22c299b02','Order by KG','Choose dishes and a weight for each.','ORDER_BY_KG',true,3,false,NOW(),NOW());
INSERT INTO package_versions (id,package_id,version_no,base_price_per_plate,min_guest_count,is_active,created_at,updated_at)
VALUES ('6b01c3ef-ec3a-4b80-8b35-20a22c299b03','6b01c3ef-ec3a-4b80-8b35-20a22c299b02',1,0,1,true,NOW(),NOW());
