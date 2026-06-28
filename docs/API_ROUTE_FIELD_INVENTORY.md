# API, route, and field inventory

This inventory is the deletion guardrail for the simplification work. `npm run test:contracts` rejects known missing or duplicate frontend calls.

Transport path, parameter, request-body, status, and response contracts are generated from the Nest OpenAPI document into `packages/shared-types/src/generated-api.ts`. Run `npm run contracts:generate` after controller/DTO changes and `npm run contracts:check` to reject drift.

| Domain                 | API owner                                   | Current caller                      | Simplification decision                                                              |
| ---------------------- | ------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| Authentication         | `AuthController`                            | customer/admin session flows        | Keep OTP/admin login and shared refresh adapter                                      |
| Users and addresses    | `UsersController`                           | profile, address picker, selectors  | Keep; selectors consume saved coordinates                                            |
| Packages/configuration | `PackagesController`                        | discovery and selectors             | Keep list/configuration; remove standalone validate/price after cart quote migration |
| Menu                   | `MenuController`                            | package configuration/admin catalog | Keep list; remove item detail if no caller remains                                   |
| Cart                   | `CartController`                            | all three selectors and checkout    | Canonical write/quote/checkout owner                                                 |
| Orders                 | `OrdersController`                          | order history/detail                | Keep reads/cancel; remove direct quote/create                                        |
| Payments               | `PaymentsController`                        | checkout/payment status             | Keep create/verify/webhook; make idempotent                                          |
| Operating regions      | `OperatingRegionsController`                | selectors/admin filters             | Keep all three launch regions                                                        |
| Admin menu             | `AdminMenuController`                       | Catalog                             | Keep role-restricted CRUD                                                            |
| Admin packages         | `AdminPackagesController`                   | Packages editor                     | Keep role-based composition only                                                     |
| Admin orders/refunds   | `AdminOrdersController`                     | Orders and Payments                 | Keep operations; full refund only                                                    |
| Operations/reports     | `OperationsController`, `ReportsController` | admin dashboard/orders              | Consolidate into dashboard summary and order filters                                 |
| Storage                | `StorageController`                         | menu image upload                   | Keep for visualizer imagery                                                          |
| Documents              | customer/admin document routes              | order detail                        | Keep invoice/receipt and refund credit note                                          |

## Field ownership

- `boxPrice`: meal-box included value and positive swap difference.
- `generalPrice`: fixed-package extras and custom-package selections.
- `Package.type`, `PackageMenuItem.role`, `isSwappable`: authoritative product rules.
- Cart event/address/pax/location columns: draft selector state and quote inputs; there is no standalone Event table.
- Order prices, items, event/address, payment, refund, and document snapshots: immutable history copied at checkout.
- Operating-region coordinates/radius/fees: serviceability and delivery pricing for Hyderabad, Karimnagar, and Warangal.
