# Sync Local DB to Neon

Syncs the local `aranyam` PostgreSQL database to the Neon production DB.
Covers: schema migration, menu categories, menu items, packages, package versions, package menu items.

## What this syncs
Tables: `menu_categories`, `menu_items`, `packages`, `package_versions`, `package_menu_items`
Preserves: `users`, `orders`, `admin_users`, `payments` and all other tables (not touched)

## Prerequisites
- PostgreSQL 18 installed at `C:\Program Files\PostgreSQL\18\bin\`
- Local DB: `postgresql://postgres:postgres@localhost:5432/aranyam`
- Neon URL: `postgresql://neondb_owner:npg_6aljv8gesTty@ep-proud-base-aosy3svz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

---

## Step 1 — Check Neon schema vs local

Run the following to see if Neon needs a schema migration:

```sql
-- Run against Neon
SELECT column_name FROM information_schema.columns WHERE table_name = 'menu_items' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns WHERE table_name = 'package_menu_items' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns WHERE table_name = 'packages' ORDER BY ordinal_position;
```

**Expected columns (local schema):**
- `menu_items`: `id, category_id, name, description, box_price, general_price, is_veg, is_active, image_url, created_at, updated_at, deleted_at`
- `package_menu_items`: `id, package_version_id, category_id, menu_item_id, role, is_available, is_swappable, display_order, created_at, updated_at`
- `packages`: `id, name, description, type, is_active, display_order, created_at, updated_at, deleted_at`

If Neon still has **old columns** (`base_price`, `is_custom`, missing `role`/`is_swappable`/`display_order`), run Step 2.

---

## Step 2 — Migrate Neon schema (only needed once, or after API migrations)

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' 'postgresql://neondb_owner:npg_6aljv8gesTty@ep-proud-base-aosy3svz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -c "
ALTER TABLE public.menu_items RENAME COLUMN base_price TO box_price;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS general_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.package_menu_items ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'INCLUDED';
ALTER TABLE public.package_menu_items ADD COLUMN IF NOT EXISTS is_swappable BOOLEAN DEFAULT false;
ALTER TABLE public.package_menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'FIXED_PACKAGE';
ALTER TABLE public.packages DROP COLUMN IF EXISTS is_custom;
"
```

---

## Step 3 — Clear old menu/package data on Neon

This is safe — it only clears the 5 synced tables. Users, orders, payments are untouched.

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' 'postgresql://neondb_owner:npg_6aljv8gesTty@ep-proud-base-aosy3svz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -c "
TRUNCATE public.package_menu_items, public.package_versions, public.packages, public.menu_items, public.menu_categories CASCADE;
"
```

---

## Step 4 — Dump data from local as INSERT statements

> **Important:** Neon uses PgBouncer connection pooling which blocks `COPY` commands.  
> Always use `--inserts` flag. Never use `pg_dump` without it for Neon.

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' `
  -U postgres -d aranyam `
  --data-only --inserts --column-inserts `
  --table=menu_categories `
  --table=menu_items `
  --table=packages `
  --table=package_versions `
  --table=package_menu_items `
  --no-acl --no-owner `
  -f 'C:\Temp\tff_data.sql'
```

---

## Step 5 — Import to Neon

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' 'postgresql://neondb_owner:npg_6aljv8gesTty@ep-proud-base-aosy3svz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f 'C:\Temp\tff_data.sql'
```

---

## Step 6 — Verify

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' 'postgresql://neondb_owner:npg_6aljv8gesTty@ep-proud-base-aosy3svz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -c "
SELECT p.name AS package, COUNT(pmi.id) AS items
FROM public.packages p
LEFT JOIN public.package_versions pv ON pv.package_id = p.id
LEFT JOIN public.package_menu_items pmi ON pmi.package_version_id = pv.id
GROUP BY p.name ORDER BY p.name;
"
```

Expected output: Pooja (11 items), Farmhouse (12), Corporate (12), meal boxes (3/5/8 each), Custom (0).

---

## Gotchas

| Problem | Cause | Fix |
|---|---|---|
| `column "box_price" does not exist` | Neon schema is old | Run Step 2 |
| `backslash commands are restricted` | PgBouncer blocks COPY | Use `--inserts` in pg_dump |
| `menu_items` imports 0 rows silently | Column order differs between local and Neon (e.g. `general_price` added at end on Neon) — positional VALUES mismatch types | Always use `--column-inserts` so INSERT names each column explicitly |
| `relation "packages" does not exist` | Neon pooler drops `search_path` | Use `public.packages` explicitly |
| `permission denied to set session_replication_role` | No superuser on Neon | Insert in correct FK order (categories → items → packages → versions → pkg_menu_items) |
| FK constraint violation on import | Wrong insert order | Use `--inserts` (pg_dump auto-orders correctly) |

---

## Neon-specific notes

- **Connection string**: Use the `-pooler` URL for all operations (it's what Vercel uses)
- **Search path**: Neon's pooler may reset `search_path`. Always prefix with `public.` in raw SQL
- **COPY not supported**: PgBouncer (Neon's pooler) blocks `COPY FROM STDIN` — always use `--inserts`
- **No superuser**: Can't run `SET session_replication_role`, `ALTER SYSTEM`, etc.

---

## Full one-liner (for repeat syncs after data is already schema-correct)

```powershell
# Dump
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -U postgres -d aranyam --data-only --inserts --column-inserts --table=menu_categories --table=menu_items --table=packages --table=package_versions --table=package_menu_items --no-acl --no-owner -f 'C:\Temp\tff_data.sql'

# Clear Neon
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' 'postgresql://neondb_owner:npg_6aljv8gesTty@ep-proud-base-aosy3svz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -c "TRUNCATE public.package_menu_items, public.package_versions, public.packages, public.menu_items, public.menu_categories CASCADE;"

# Import
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' 'postgresql://neondb_owner:npg_6aljv8gesTty@ep-proud-base-aosy3svz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f 'C:\Temp\tff_data.sql'
```

Replace `<NEON_URL>` with the actual connection string each time.
