ALTER TABLE carts ADD COLUMN contact_number VARCHAR(10);
UPDATE carts c
SET contact_number = u.mobile_number
FROM users u
WHERE u.id = c.user_id;
ALTER TABLE carts ALTER COLUMN contact_number SET NOT NULL;
ALTER TABLE carts ADD CONSTRAINT carts_contact_number_format CHECK (contact_number ~ '^[6-9][0-9]{9}$');

ALTER TABLE orders ADD COLUMN contact_number VARCHAR(10);
UPDATE orders o
SET contact_number = u.mobile_number
FROM users u
WHERE u.id = o.user_id;
ALTER TABLE orders ALTER COLUMN contact_number SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_contact_number_format CHECK (contact_number ~ '^[6-9][0-9]{9}$');
