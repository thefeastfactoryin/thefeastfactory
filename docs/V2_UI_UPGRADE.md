# Feast Factory V2 UI Upgrade

## Purpose

This document captures the current discussion and planned changes for the V2 Feast Factory customer experience before API integration. The goal is to move from a standard menu/cart flow into a more visual, mobile-friendly buffet and package builder that supports meal boxes, fixed packages, custom packages, cart persistence, and the revised pricing model.

## Product Direction

The V2 experience should feel premium, visual, and easy to use in a mobile browser. The strongest direction from the prototypes is a visual buffet/table builder where selected dishes appear as trays on a banquet table, while the user can still browse categories and add items quickly.

The UI should avoid a plain ecommerce menu feeling. The primary screen should show the event context, selected items, estimated pricing, and the next action without making the user open several pages.

## Prototype Directions Discussed

### 1. Desktop Visual Buffet Builder

This is the wide-screen version of the experience.

- Top bar shows brand, event type, event date, guest count, save, summary, and proceed.
- Left panel shows menu/package tabs, search, filters, category chips, and dish cards.
- Main canvas shows a decorated banquet table with trays.
- Added dishes appear in filled trays.
- Empty trays show add-item affordances.
- Bottom summary shows item count, veg count, non-veg count, estimated cost, and help.

This works well for desktop and tablet planning sessions.

### 2. Mobile Visual Builder

This is the mobile-first browser experience.

- Header shows brand, menu icon, and account/profile action.
- Event strip shows event type, date, and guests.
- Visual table stays central and immediately visible.
- A sticky bottom action opens the menu as a bottom sheet.
- Dish selection happens in a bottom sheet with category navigation.
- Once items are added, the visual table updates.
- Sticky footer shows item count, guests, estimated cost, and proceed.

This is the preferred baseline for mobile because it is visual but still one-hand friendly.

### 3. Package / Meal Box Swap Screen

This screen supports fixed or semi-fixed selections.

- Shows selected package or meal box at the top.
- Shows included items grouped by category.
- Locked items cannot be edited.
- Swappable items expose a replace action.
- Swap options are filtered by the same category and same veg/non-veg type.
- Invalid swaps are never shown or are clearly disabled.
- Price can only increase on a swap, never decrease.
- Summary shows base package price, swap adjustments, extras, and final estimate.

This is important for meal boxes, where only some included items can be swapped.

### 4. Custom Menu First Screen

For custom packages, the preferred first screen should be a guided category checklist rather than an empty visual table.

- Start with event details and guest count.
- Show required or recommended categories.
- Let the user add dishes category by category.
- Show category progress such as starters, mains, breads, rice, desserts.
- Show selected item count and estimated total in a sticky footer.
- Add a visual table preview or toggle after the first few selections.

Recommended approach: use the guided checklist screen as the first screen for custom menu selection, then let users switch into visual table mode as their selection grows.

## Package Types

### Meal Boxes

Meal boxes have a fixed set of included items. Some included items can be swapped, while others are standard and locked.

Rules:

- Included items use `MenuItem.boxPrice`.
- Swap is allowed only when the original package item has `isSwappable = true`.
- Replacement item must have the same `categoryId`.
- Replacement item must have the same `isVeg` value.
- Replacement item must be active and not deleted.
- Swap price adjustment is `max(replacement.boxPrice - original.boxPrice, 0)`.
- Price should never decrease even if the replacement item is cheaper.

### Fixed Packages

Fixed packages have included items that cannot be edited or swapped.

Rules:

- Included items are locked.
- User can add only configured extras.
- Extras are defined by `PackageMenuItem.role = EXTRA`.
- Extra items use `MenuItem.generalPrice`.
- Extra pricing applies for all selected pax.

### Custom Packages

Custom packages are built by the user from selectable menu items.

Rules:

- Custom package base price should be `0.00`.
- Selected items use `MenuItem.generalPrice`.
- Items can be grouped and guided by category.
- If no explicit custom-selectable configuration exists, all active menu items can be treated as selectable.

## Pricing Model

The add-on price field is not needed on package menu items.

Use two prices on `MenuItem`:

- `boxPrice`: used for meal boxes and meal-box swap difference calculations.
- `generalPrice`: used for fixed-package extras and custom package items.

No package/menu add-on price fields should be stored. Pricing should be derived from the selected package type, item role, and the current menu item price.

Cart pricing should be treated as a quote, not as final source of truth. Checkout must reprice before creating the order snapshot.

## Schema Changes Planned

The revised schema proposal should support the following concepts.

### Enums

- `PackageType`: `MEAL_BOX`, `FIXED_PACKAGE`, `CUSTOM_PACKAGE`
- `PackageMenuItemRole`: `INCLUDED`, `EXTRA`, `CUSTOM_SELECTABLE`
- `SelectedItemRole`: `INCLUDED`, `SWAP`, `EXTRA`, `CUSTOM`
- `CartStatus`: `ACTIVE`, `CHECKED_OUT`, `ABANDONED`, `EXPIRED`

### Menu And Package Tables

- `MenuItem` should replace `basePrice` with `boxPrice` and `generalPrice`.
- `Package` should replace `isCustom` with `type PackageType`.
- `PackageMenuItem` should be configuration-only.
- `PackageMenuItem` should keep `role`, `isAvailable`, `isSwappable`, and `displayOrder`.
- `PackageMenuItem` should not contain pricing fields.
- `swapGroupKey` should be removed because swaps are based on category and veg/non-veg.
- `PackageCategoryRule` should be removed.
- `PackageMenuItemPricing` should be removed.

### Cart Tables

Add a database-backed cart so draft selections can survive refreshes and device changes.

`Cart` should store:

- `userId`
- `packageVersionId`
- nullable `eventId`
- `status`
- `expiresAt`
- `lastQuotedAt`
- timestamps

`CartItem` should store:

- `cartId`
- `categoryId`
- `menuItemId`
- nullable `replacedMenuItemId`
- `role`
- `quantity`
- timestamps

Cart rows should represent draft intent. Final order pricing should be snapshotted only after checkout repricing.

### Order Snapshot Tables

`Order` should support:

- nullable unique `cartId`
- event and address references
- immutable order totals and status fields

`OrderSelectedItem` should support:

- `role`
- nullable `replacedMenuItemId`
- nullable `replacedMenuItemName`
- `menuItemName`
- `categoryName`
- `isVeg`
- `itemPrice`
- `includedValue`
- `adjustmentAmount`

This lets the order remain auditable even if menu items or package configuration changes later.

### Event Table

Keep the `Event` table.

It is useful for:

- event type
- event date
- event time
- guest count
- venue/address
- delivery/service calculations
- notes and planning status

A cart can start before an event is fully known, but checkout should attach an event to the final order.

### Display Order Fields

Keep display ordering where it controls UI order:

- `MenuCategory.displayOrder`
- `Package.displayOrder`
- `PackageMenuItem.displayOrder`

Do not add `MenuItem.displayOrder` unless manual ordering of items within categories becomes a real admin requirement.

## API Changes Planned

### Menu APIs

- Return `boxPrice` and `generalPrice`.
- Support filtering by category, veg/non-veg, active status, and package context.
- For meal-box swaps, expose only valid replacement items.

### Package APIs

- Return package type.
- Return active package version.
- Return included, extra, and custom-selectable item configuration.
- Clearly mark locked and swappable included items.

### Cart APIs

Needed endpoints:

- Create or fetch active cart.
- Add item.
- Remove item.
- Update quantity.
- Swap meal-box item.
- Quote/reprice cart.
- Attach or update event details.
- Checkout cart into order.

Cart quote responses should include:

- base package amount
- included value
- swap adjustments
- extras amount
- custom item amount
- estimated subtotal
- taxes if available
- final estimated total

### Order APIs

- Create order from repriced cart.
- Store final order snapshots.
- Return order summary and selected items.
- Preserve selected item names, prices, category names, and replacement details.

## UI Implementation Plan

### Phase 1: Static Prototypes

- Build three mobile-friendly screens before API integration.
- Use seeded/static data from the CSV shape.
- Use realistic dish names, category names, and prices.
- Generate or reuse visual assets for trays, banquet table, dish images, and logo treatment.

Screens:

- Visual buffet builder.
- Package or meal-box swap flow.
- Custom menu first screen with guided categories.

### Phase 2: Local State Prototype

- Add client-side state for selected items.
- Show tray filling behavior.
- Show item counts and estimated cost.
- Add bottom sheet menu for mobile.
- Add summary/proceed sticky footer.
- Add swap validations in the UI.

### Phase 3: API Integration

- Replace static menu data with menu APIs.
- Replace static packages with package APIs.
- Persist draft selections into database cart.
- Requote cart before proceed.
- Create order from cart on checkout.

### Phase 4: Seed Data

Seed the database from:

`docs/TFF - Menu - Menu - Meal Box.csv`

Planned mapping:

- CSV `CategoryName` to `MenuCategory.name`.
- CSV `ItemName` to `MenuItem.name`.
- CSV `Our Price` or final cleaned value to default `boxPrice`.
- Derive or assign `generalPrice` based on package pricing rules.
- Detect veg/non-veg from category name and item context.
- Seed meal-box package templates from the side columns in the CSV if reliable.

Manual review may be needed because the CSV contains menu rows and package template columns in the same sheet.

## Visual Asset Plan

The UI will need production-friendly visual assets.

Likely assets:

- Feast Factory logo treatment.
- Banquet table background.
- Empty chafing dish/tray.
- Filled tray states for common food categories.
- Dish thumbnails for menu list cards.
- Simple category icons.

Generated assets are acceptable for prototypes. Before production, confirm whether the brand logo and food imagery need to be replaced with approved assets.

## Validation Checklist

- Mobile browser layout works without horizontal scroll.
- Visual table remains visible and useful on mobile.
- Bottom sheet does not cover critical summary actions.
- Prices update immediately when items are added, removed, or swapped.
- Meal-box swaps never reduce price.
- Meal-box swaps allow only same category and same veg/non-veg.
- Fixed package included items cannot be edited.
- Fixed package extras use `generalPrice`.
- Custom package items use `generalPrice`.
- Cart persists in database.
- Checkout reprices before order creation.
- Order stores immutable pricing snapshots.

## Open Decisions

- Confirm final mobile first screen: guided custom menu checklist is currently recommended.
- Confirm whether custom packages should require minimum category counts.
- Confirm whether fixed-package extras must be preconfigured per package or can include all menu items.
- Confirm how `generalPrice` should be calculated when only box pricing exists in the CSV.
- Confirm tax, delivery, distance, and service charge rules.
- Confirm final approved brand and food assets.

## Current Recommendation

Use the guided custom menu screen as the first custom package experience, keep the visual buffet table as the signature builder, and use the package/meal-box swap screen only when the selected package has included items. This gives the app a premium visual identity without making custom menu selection feel empty or confusing at the start.
