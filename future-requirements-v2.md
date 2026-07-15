# Future Requirements V2

## General

- Remove the curated food option.
- Keep the ordering style—Custom, Package, and Menu—visible at the top without scrolling.
- Add WhatsApp help. **Status:** Will add.

## Meal Box

- Meal box sizes: 3 items, 5 items, and 8 items (vegetarian and non-vegetarian). **Status:** Already available.
- Swap-item functionality is not working.
- Item categories should not be visible.
- Provide `+` and `-` controls and allow manual quantity updates.
- Format the total amount.
- Display all numbers using Arial.
- Add an **Add to Cart** option.
- Add an **ORDER NOW** option.

## Packages

- Swap option is not available. **Status:** Will check.
- Add an extras option below each item.
- All items are visible under **Extras**. **Status:** Already available.
- Provide `+` and `-` controls for package items; the minimum quantity should be the package count/size.
- Do not accept `0` when a quantity is entered manually.
- Menu categorization is needed for extras.
- Use the same guest count added in the box.

## Clarification Questions

1. **Do not ask for the number of boxes in Meal Box.**
   - Could you clarify the intended behavior?

2. **Remove the curated food option.**
   - Should only the UI option be removed, or should the entire offering be removed?
   - Does this mean the table item display should be removed?

3. **Add an extras option below each item.**
   - Package items are currently displayed, and extras are available in a separate tab beside them.
   - If an item is already included in the package and the customer wants to increase its quantity, should anything change in the current flow?

4. **Provide `+` and `-` controls for package items; the minimum quantity should be the package count/size.**
   - Should customers be able to separately increase the quantity of items already included in the package?

5. **Use the same guest count added in the box.**
   - Could you clarify the intended behavior?

## Codebase Implementation Assessment

### General

#### Remove the curated food option

The phrase **“Curated food experiences”** currently appears as the brand subtitle in the sticky customer header. If this requirement refers to that text, remove the subtitle from `apps/customer-web/components/customer-shell.tsx`.

The application also contains curated-package marketing copy in `apps/customer-web/components/catalog/package-grid-page.tsx` and `apps/customer-web/lib/catalog-display.ts`. Removing the underlying curated/package offering would be a much larger catalog and routing change, so this requirement still needs the product clarification above.

#### Keep Custom, Package, and Menu ordering styles visible at the top

The customer header is already sticky and includes **Menu**, **Packages**, and **Meal Boxes** in `apps/customer-web/components/customer-shell.tsx`. There is no explicit **Custom** navigation item; custom packages are entered through the package catalog and then routed to `/packages/build`.

Recommended implementation:

- Confirm whether **Custom** means the existing custom-package builder.
- Add a dedicated top-level link for it, or rename/restructure the three ordering choices to exactly **Custom / Package / Menu**.
- Update both `navLinks` and `mobileLinks` so desktop and mobile remain consistent.
- If the choices must be data-driven, use the existing `/catalog/ordering-offerings` API rather than another hardcoded list.

#### Add WhatsApp help

No WhatsApp link or floating help action currently exists. Add a reusable customer-web component rendered by `CustomerShell`, using a configured phone number and a `https://wa.me/<number>?text=<message>` link. The phone number should come from public settings/environment configuration rather than being hardcoded. Include an accessible label and ensure the floating action does not overlap the mobile navigation or menu-builder action bar.

### Meal Box

#### Sizes and dietary variants

Meal boxes are already represented by `MEAL_BOX` packages and filtered as vegetarian/non-vegetarian in `apps/customer-web/components/catalog/package-grid-page.tsx`. The actual 3-, 5-, and 8-item variants are catalog records, so completeness should be verified in seeded/production data rather than implemented as hardcoded UI choices.

#### Swap functionality

The customer UI, state store, API pricing, and persistence paths already support meal-box swaps:

- UI and swap drawer: `apps/customer-web/app/menu/select/page.tsx`
- Local selection state: `apps/customer-web/store/order-builder.store.ts`
- Eligibility and pricing validation: `apps/api/src/modules/pricing/pricing.service.ts`
- Cart persistence: `apps/api/src/modules/cart/cart.service.ts`

Swaps only appear when an included package item has `isSwappable` enabled and eligible same-category, same-diet replacement items are configured. First verify the affected meal-box configuration returned by `/package-versions/:id/configuration`. If configuration is present but swapping still fails, reproduce the request and inspect the API validation message before changing the swap logic.

#### Hide item categories

Category names are intentionally displayed in several meal-box/menu views, particularly the menu filters, section headings, item descriptions, details, and summary in `apps/customer-web/app/menu/select/page.tsx`.

Recommended implementation:

- Hide category labels only when `isMealBox` is true.
- Keep category IDs internally because swap eligibility and API validation depend on them.
- Decide whether category filters should also disappear for meal boxes or only the category text on item cards.

#### Quantity controls and the number of boxes

Meal-box quantity is currently represented by the shared `guestCount` value and displayed as “boxes.” It is initialized to the package version’s `minGuestCount` in `apps/customer-web/store/order-builder.store.ts` and in package-selection flows. The menu-select screen displays this value but does not provide a box-count stepper.

Recommended implementation:

- Rename the customer-facing concept to `boxCount` for meal boxes while retaining `guestCount` in the current API/database contract, unless a schema migration is desired.
- Add a reusable numeric stepper to the meal-box menu or cart flow, bounded by the package version’s `minGuestCount` and `maxGuestCount`.
- Persist changes through `setGuestCount` locally and the cart update endpoint for authenticated users.
- Clarify “Do not ask for the number of boxes” before adding this control, because it conflicts with the request for manual `+`/`-` quantity updates.

#### Format the total amount

Currency formatting already uses `Intl.NumberFormat('en-IN', { currency: 'INR' })` through `apps/customer-web/lib/format.ts`. The menu builder uses this formatter for its subtotal and summary. Audit other screens for raw amount output, but do not introduce a second formatter.

#### Display all numbers using Arial

The application currently uses Inter globally, with Nunito Sans and slab/serif display fonts on package screens. Applying Arial only to numeric glyphs would require a dedicated utility/class (for example, a numeric typography class) and consistent application to prices, counts, quantities, dates, and summary values. A global switch to Arial would affect all copy, not only numbers. Confirm the intended scope before implementation.

#### Add to Cart and ORDER NOW

The custom package builder already has **Add to Cart**. The fixed-package and meal-box menu flow currently uses **Continue to event & payment**, saves the cart, and routes to `/cart`.

Recommended semantics:

- **Add to Cart:** save the current selection and route to `/cart` (or remain on the page with confirmation, if multi-item carts are planned).
- **ORDER NOW:** save the same selection and route directly to `/checkout`, provided the cart has all required event/address information; otherwise route to the next required checkout step.
- Reuse the existing `continueToCart` persistence logic in `apps/customer-web/app/menu/select/page.tsx` through a shared save function so both actions submit identical data.

### Packages

#### Swap option

Fixed-package swaps use the same implementation as meal boxes. Availability is configuration-driven through `isSwappable` and replacement rows. Verify package configuration first; the UI already exposes **Swap item** when eligible.

#### Extras placement and categorization

Extras already appear in a separate **Extras (add more)** tab in `apps/customer-web/app/menu/select/page.tsx`. They use the same category, diet, and search filters as included items, so menu categorization already exists technically.

If extras must appear below each included item instead of in a separate tab, a product rule is needed to associate an extra with a specific included item. The current model associates extras with a package version and category, not with an individual included package item. Without a new relationship, the safest presentation is to show same-category extras beneath each included item, but that could duplicate an extra in multiple places.

#### Package item quantity controls

Quantity controls already exist for selected extras. They default to the guest count, allow values from `1` through the guest count, and are persisted in cart selections. Included package items do not currently have independent quantities because they are part of the base per-guest package.

Allowing additional quantities of an included item requires one of these models:

1. Configure the same menu item as an `EXTRA` as well as `INCLUDED`, then use the existing extra-quantity and pricing flow.
2. Add a new “additional quantity” field/role for included items and extend pricing, cart, order snapshots, API types, admin configuration, and UI.

The first option fits the current architecture and is lower risk.

#### Reject zero quantities

This is already enforced in multiple layers:

- The extras UI normalizes manual input to a minimum of `1`.
- `CartSelectionItemDto` and `SelectedPackageItemDto` use `@Min(1)`.
- Fixed-package pricing rejects quantities below `1`.

Add focused UI tests for blank, zero, negative, decimal, and above-guest-count input to prevent regressions.

#### Use the same guest count added in the box

The package flow already uses one shared `guestCount` value for package pricing and as the default/max quantity for extras. If “box” refers to another screen or field, identify that source explicitly. No second guest-count state should be introduced; the existing order-builder store and cart event guest count should remain the source of truth.

## Suggested Delivery Order

1. Resolve the five clarification questions, especially the conflicts around meal-box quantity and package included-item quantities.
2. Verify swap and catalog configuration using the affected package-version API responses.
3. Implement small UI-only changes: header subtitle, top ordering links, WhatsApp help, meal-box category visibility, and CTA labels/actions.
4. Add or reuse the quantity stepper once box-count behavior is confirmed.
5. Only extend the data model if product rejects the existing “included item also configured as an extra” approach.
6. Add customer-web and API regression tests for swaps, quantity boundaries, cart persistence, and totals.

## Confirmed Implementation Update

- Extra quantities now default to the selected pax count but have no pax-based maximum. Customers can use both `+`/`-` controls and direct numeric entry. The minimum remains `1`.
- Meal-box count remains part of the flow and can be changed through `+`/`-` controls or direct entry, subject to the configured package minimum/maximum.
- The menu summary no longer presents the raw “Calculation” formula or the Included/Extras/Guests tag stack. It now shows a concise base-package line, additional-items amount when applicable, substitutions when used, order size, and estimated total.
- Price, count, and quantity values use a consistent Arial numeric style with tabular figures.
- The custom menu remains available, but the banquet visualizer has been removed from the active custom-menu flow. The legacy visual-builder route redirects to the regular custom-menu selector.
- The same menu item can exist as both `INCLUDED` and `EXTRA` at the database/API level because package-item uniqueness includes the role. The current admin editor still exposes only one role per item, so dual-role configuration requires a follow-up admin UI enhancement or direct API configuration.
- The fifth clarification question is ignored as requested.

### Swap Configuration Verification

Swap behavior is implemented and covered by API tests. Current local catalog data explains why it is not visible for fixed packages:

- Meal boxes have swapping enabled for most included items.
- **Corporate Gathering**, **Farm House Celebration**, and **Pooja Package** currently have zero included items marked as swappable.

For local testing, `npm run db:package-swaps` now enables up to three eligible included items in every active fixed package. The script is idempotent and only selects items that have an active same-category, same-diet alternative. The current local result is three swappable items each for **Corporate Gathering**, **Farm House Celebration**, and **Pooja Package**.
