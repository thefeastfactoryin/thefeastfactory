# Project simplification flow audit

Date: 2026-06-28  
Scope: customer discovery, meal-box swap, fixed-package extras, custom builder, and admin order filtering at 1280×720 and 390×844.

## Steps and health

1. **Meal-box discovery — healthy.** The Meal Boxes tab is URL-backed, the cards explain fixed/swappable behavior, and the viewport has no horizontal page overflow. Evidence: `01-customer-meal-boxes-desktop.png`.
2. **Package discovery/comparison — healthy.** Fixed and custom products share one route, Gold is correctly recommended as the median fixed-package price, and the rule summary remains visible before selection. Evidence: `02-customer-packages-desktop.png` and `04-customer-packages-mobile.png`.
3. **Fixed-package selector — healthy after correction.** Included items are checked, disabled, and grouped before a labelled optional-extras area. The estimate counts extras only. Evidence: `03-fixed-package-selector-desktop.png`.
4. **Meal-box swap — healthy.** Only same-category alternatives appear in a mobile bottom drawer. A ₹5 increase changed the local estimate from ₹99 to ₹104 per pax; equal/cheaper alternatives remained labelled “No price change.” Evidence: `05-meal-box-swap-mobile.png`.
5. **Custom builder — healthy after correction.** A normal click now adds/removes an item, selected-item pricing is item-derived, the ten-pax estimate updates, and All/Veg/Non-veg filters are explicit. Evidence: `06-custom-builder-mobile.png`.
6. **Admin orders desktop — healthy.** The simplified navigation exposes only real routes, all three launch regions remain filterable, server pagination is wired, and the empty state is clear. Evidence: `07-admin-orders-desktop.png`.
7. **Admin orders mobile — usable with a contained table scroll.** Filters reflow to one column and the page itself does not overflow horizontally; the result table remains horizontally scrollable. Evidence: `08-admin-orders-mobile.png`.
8. **Payment failure — healthy after correction.** Missing/failed order lookup now resolves to a named “Payment failed” state with a retry action instead of remaining indefinitely on “Confirming payment.”
9. **Authenticated empty cart — healthy after correction.** The browser pass exposed a successful empty API response being parsed as JSON. The shared request client now accepts both `204` and empty `200` responses, and the customer sees the intended “Your cart is empty” action state. A regression test covers the shared client behavior.

## Accessibility observations

- Confirmed from DOM/browser interaction: semantic headings, labelled product tabs, named action buttons, disabled checked inclusions, dialog name/modal semantics, explicit close actions, text labels in addition to color, and 390px reflow without page-level horizontal scrolling.
- The swap action works without hover, so its rules and price changes remain available on touch devices.
- A 640px CSS viewport (the reflow equivalent of 200% zoom at 1280px) had no horizontal page overflow. A computed-style contrast sample found no WCAG AA text failures on the login flow. Login/OTP accessible names were shortened to their actual field labels, and async danger/loading panels now expose alert/status live regions.
- Customer and admin styles now provide a global `:focus-visible` fallback for every link, button, native form control, summary, and explicit tab stop; specialized components retain their stronger ring styles.
- Remaining verification gap: complete physical keyboard traversal/dialog focus return and a screen-reader announcement pass with assistive technology. The automation surface could focus individual controls but did not synthesize native browser Tab traversal reliably, so this is deliberately not claimed as complete WCAG certification.

## Business-flow validation

- Meal boxes: configured defaults are selected; only explicitly swappable rows can change; the server test proves price never decreases.
- Fixed packages: included items are immutable; only configured extras can be selected; extra prices apply per pax.
- Custom packages: every selected item contributes its general price per pax; the browser and database-backed tests agree.
- Checkout remains cart-only, full refunds are server-calculated/idempotent, and invoice/refund documents use order/payment snapshots.

## Known launch dependencies

- Replace placeholder legal name, GSTIN, registration, address, tax rates, numbering, and invoice wording with accountant-approved values.
- Add approved food imagery to `MenuItem.imageUrl`; the builder currently falls back to accessible text/icon representations.
- Historical completion-time/drop-off comparison requires production analytics and cannot be validated from this empty development database.
