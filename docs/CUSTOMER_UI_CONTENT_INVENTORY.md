# Customer UI content inventory

This inventory records where customer-visible data belongs after the catalog remediation. Catalog and operational values come from PostgreSQL; stable presentation copy and asset mappings remain typed in the frontend.

## Database-owned content

| Content | Source | Customer usage |
| --- | --- | --- |
| Ordering options | `ordering_offerings` | Home ordering cards; active state and display order |
| Package and meal-box identity | `packages` | Name, description, type, visibility, catalog order |
| Featured packages | `packages.is_featured`, `featured_order` | Home popular-package section |
| Price and guest limits | `package_versions` | Catalog cards, selection, quote, checkout |
| Package inclusions and swap rules | `package_menu_items` | Card highlights and menu builder |
| Categories and dishes | `menu_categories`, `menu_items` | Menu navigation, dietary filter, cards, pricing |
| Cart, event, venue, menu selection | `carts`, `cart_items`, `user_addresses` | Resume, quote, checkout |
| Orders, payments, history, documents | order/payment tables | Past orders, tracking, receipts and invoices |

## Code-owned content

| Collection | Location | Reason |
| --- | --- | --- |
| Offering routes and artwork | `apps/customer-web/lib/catalog-display.ts` | Routes, icons and bundled artwork are deploy-time presentation concerns |
| Trust and package-benefit copy | `apps/customer-web/lib/catalog-display.ts` | Stable marketing copy; no operational effect |
| Brand, navigation, status and legal copy | `packages/shared-types/src/constants.ts` | Shared, typed application language |
| State/status option lists | `packages/shared-types/src/options.ts` | Mirrors API enums and form choices |
| Menu image fallbacks | `apps/customer-web/app/menu/page.tsx` | Temporary visual fallback until every menu item has `imageUrl` |
| About-page statistics and narrative | `apps/customer-web/app/about/page.tsx` | Approved marketing content; intentionally unchanged |

Removed from page components: `ORDER_TYPES`, hardcoded home `PACKAGES`, `PKG_CARDS`, `COMPARE_COLS`, `COMPARE_ROWS`, meal-box product metadata, synthetic dish tags, and inferred preparation labels.

## Image reference

| Asset | Current use |
| --- | --- |
| `/logo.png` | Global header logo |
| `/Hero.png`, `/home-hero.png` | Home hero/reference artwork |
| `/order-mealbox.png` | Meal-box ordering option |
| `/order-occasion.png` | Package ordering option and legacy package hero |
| `/order-build.png` | Build-your-menu ordering option/custom package |
| `/pkg-puja.png` | Pooja package fallback |
| `/pkg-farmhouse.png` | Farm House package fallback |
| `/pkg-corporate.png` | Corporate package fallback |
| `/pkg-community.png` | Generic fixed-package fallback |
| `/tray-3.png`, `/tray-5.png`, `/tray-8.png` | Meal-box size fallbacks |
| `/about-hero.png`, `/about-gathering.png`, `/feat-fresh.png` | About page |
| `/inc-starter.png`, `/inc-main.png`, `/inc-rice.png`, `/inc-dessert.png`, `/inc-beverage.png` | Legacy inclusion artwork retained for reference |
| `/sidebar-thumb.png` | Legacy selection artwork retained for reference |
| Unsplash category URLs in `menu/page.tsx` | Temporary dish fallbacks when DB `imageUrl` is empty |

Future asset migration should add managed `imageUrl` fields to ordering offerings and packages, upload these files through the existing storage module, then remove the name-based fallback map.
