# Catalog remediation visual QA

1. **Packages before — unhealthy.** `01-packages-before.png` shows every eligible extra rendered as if included, producing extremely tall cards and burying actions.
2. **Meal boxes before — needs improvement.** `02-meal-boxes-before.png` shows usable structure, but source images were stretched beyond their intrinsic dimensions and missing categories had no path to add extras.
3. **Meal boxes after — healthy.** `03-meal-boxes-after-viewport.png` shows three stable desktop columns, intrinsic-size contained images, true included items, dietary/category labels, and an Add Extras action for missing categories.
4. **Packages after — healthy.** `04-packages-after-viewport.png` shows compact package cards with included-only data and overflow-safe layout. Additional inclusions are disclosed progressively.
5. **Packages mobile — healthy.** `05-packages-mobile-after.png` confirms a single 353px card column within a 390px viewport with no horizontal overflow.
6. **Menu manager after — healthy.** `06-menu-select-after.png` shows one unified grid with search, category and dietary filters; no stacked category sections remain.

Visible accessibility checks: headings and controls remain labelled; category/diet information is text, not color alone; dialogs and buttons retain semantic roles. Keyboard focus order and screen-reader announcement behavior require a separate interactive accessibility pass.
