-- FeastFactory database-owned timestamp automation.
-- Use after applying migrations from apps/api/prisma/schema.prisma.
--
-- Prisma's @updatedAt handles normal application writes. These triggers make
-- PostgreSQL the final source of truth when rows are inserted or updated by
-- SQL scripts, admin tools, imports, or future services that bypass Prisma.

CREATE OR REPLACE FUNCTION public.set_timestamps_to_db_time()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = COALESCE(NEW.created_at, statement_timestamp());
    NEW.updated_at = COALESCE(NEW.updated_at, NEW.created_at);
  ELSE
    NEW.updated_at = statement_timestamp();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_timestamps ON public.users;
CREATE TRIGGER trg_users_set_timestamps
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_user_addresses_set_timestamps ON public.user_addresses;
CREATE TRIGGER trg_user_addresses_set_timestamps
BEFORE INSERT OR UPDATE ON public.user_addresses
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_menu_categories_set_timestamps ON public.menu_categories;
CREATE TRIGGER trg_menu_categories_set_timestamps
BEFORE INSERT OR UPDATE ON public.menu_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_menu_items_set_timestamps ON public.menu_items;
CREATE TRIGGER trg_menu_items_set_timestamps
BEFORE INSERT OR UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_packages_set_timestamps ON public.packages;
CREATE TRIGGER trg_packages_set_timestamps
BEFORE INSERT OR UPDATE ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_package_versions_set_timestamps ON public.package_versions;
CREATE TRIGGER trg_package_versions_set_timestamps
BEFORE INSERT OR UPDATE ON public.package_versions
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_package_menu_items_set_timestamps ON public.package_menu_items;
CREATE TRIGGER trg_package_menu_items_set_timestamps
BEFORE INSERT OR UPDATE ON public.package_menu_items
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_carts_set_timestamps ON public.carts;
CREATE TRIGGER trg_carts_set_timestamps
BEFORE INSERT OR UPDATE ON public.carts
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_cart_items_set_timestamps ON public.cart_items;
CREATE TRIGGER trg_cart_items_set_timestamps
BEFORE INSERT OR UPDATE ON public.cart_items
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_orders_set_timestamps ON public.orders;
CREATE TRIGGER trg_orders_set_timestamps
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_payments_set_timestamps ON public.payments;
CREATE TRIGGER trg_payments_set_timestamps
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_refunds_set_timestamps ON public.refunds;
CREATE TRIGGER trg_refunds_set_timestamps
BEFORE INSERT OR UPDATE ON public.refunds
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_admin_users_set_timestamps ON public.admin_users;
CREATE TRIGGER trg_admin_users_set_timestamps
BEFORE INSERT OR UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_operating_regions_set_timestamps ON public.operating_regions;
CREATE TRIGGER trg_operating_regions_set_timestamps
BEFORE INSERT OR UPDATE ON public.operating_regions
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_order_notes_set_timestamps ON public.order_notes;
CREATE TRIGGER trg_order_notes_set_timestamps
BEFORE INSERT OR UPDATE ON public.order_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();

DROP TRIGGER IF EXISTS trg_platform_settings_set_timestamps ON public.platform_settings;
CREATE TRIGGER trg_platform_settings_set_timestamps
BEFORE INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamps_to_db_time();
