# The Feast Factory Implementation Plan

This plan is the execution guide for building The Feast Factory catering and event ordering platform from the current codebase. It is written so any developer or AI coding agent can continue the project without needing the original conversation.

## Implementation Status

Last updated: June 16, 2026

- [x] Phase 0 - Preflight and dependency installation
- [x] Phase 1 - Local PostgreSQL, Prisma schema, seed data, and DB timestamp triggers
- [ ] Phase 2 - Shared packages
  - [x] Base auth, profile, address, menu, package, event, selection, and order quote types/validation
  - [ ] Remaining order, payment, report, and admin contracts
  - [ ] Complete typed API client methods
- [ ] Phase 3 - API foundation
  - [x] Prisma module and environment validation
  - [x] Swagger bootstrap
  - [x] JWT strategy
  - [x] Customer and admin guards
  - [x] Role guard and auth decorators
  - [ ] Global exception filter and standard API error shape
  - [ ] Request logging interceptor
  - [ ] OTP/login rate limiting
- [x] Phase 4 - Authentication and user APIs
  - [x] Local console OTP provider
  - [x] OTP database storage, expiry, hashing, and attempt limits
  - [x] Customer creation/login and JWT refresh
  - [x] Admin login and JWT refresh
  - [x] Customer profile API
  - [x] Customer address CRUD and default-address handling
  - [ ] MSG91 provider activation, deferred to Phase 10
- [x] Phase 5 - Menu and package APIs
  - [x] Public menu category and menu item APIs
  - [x] Admin menu category and menu item management
  - [x] Public package listing and active-version APIs
  - [x] Package configuration grouped by category rules
  - [x] Selection validation
  - [x] Decimal customization and per-plate pricing
  - [x] Admin package/version/rule/item/pricing management
  - [x] Seeded sample dishes and Silver/Gold/Premium packages
  - [x] Postman requests for all Phase 5 endpoints
- [x] Phase 6 - Event, pricing, order, and payment APIs
- [x] Phase 7 - Admin order and reports APIs
- [x] Phase 8 - Customer web app
- [x] Phase 9 - Admin web app
- [x] Phase 9.1 - Customer cart and experience enhancement
- [x] Phase 9.2 - Public menu and Google Maps address picker
- [x] Phase 10 - External integrations
- [x] Phase 10.1 - Admin experience enhancement
- [x] Phase 10.2 - Operations features
- [ ] Phase 11 - Automated testing
- [ ] Phase 12 - Deployment preparation

Current next implementation target: **Phase 11 - Automated Testing**, followed by deployment preparation.

Latest customer experience additions:

- Persistent cart/draft order across refreshes
- Cart review route with package, event, menu, and live estimate summaries
- Incomplete-cart recovery and package-change compatibility handling
- Menu maximum-selection enforcement and category progress
- Draft event editing without duplicate event creation
- Real Razorpay browser checkout wiring with local-mode fallback and pending-payment retry
- Visual refresh for the customer shell, home, package, event, menu, cart, and checkout screens
- Production Razorpay attempts, raw-body webhooks, reconciliation, and full/partial refunds
- MSG91 OTP activation with console fallback
- Validated Google Cloud Storage menu-image uploads with local fallback
- Responsive admin operations workspace with calendar, queues, notes, settings, and payment tooling
- Customer in-app notifications and authenticated receipts/invoices/credit notes

Implemented API collection:

- `docs/postman/the-feast-factory-api.postman_collection.json`
- Includes health, customer auth, admin auth, profile, and address endpoints.
- Add every new API endpoint to this collection in the same phase that implements it.

## Current Codebase Snapshot

The repository currently contains:

- Product/source documents:
  - `PROJECT_IMPLEMENTATION_SPEC.md`
  - `schema.prisma`
  - Product `.docx` files
  - Database design `.pdf`
- Monorepo base:
  - Root `package.json`
  - `nx.json`
  - `tsconfig.base.json`
  - `eslint.config.mjs`
  - `.env.example`
  - `.gitignore`
  - `.prettierrc`
  - `README.md`
- Apps:
  - `apps/api`
  - `apps/customer-web`
  - `apps/admin-web`
- Packages:
  - `packages/shared-types`
  - `packages/validation`
  - `packages/api-client`
  - `packages/design-tokens`
- Integration guide:
  - `docs/integrations.md`

The API already has a NestJS bootstrap, config validation, Prisma service/module, health endpoint, Prisma schema copy, and seed file. The frontend apps already have base Next.js/Tailwind/Zustand/TanStack Query structure.

## Source Of Truth

Use these files in order:

1. `PROJECT_IMPLEMENTATION_SPEC.md` for product, architecture, workflows, and route targets.
2. `apps/api/prisma/schema.prisma` for implementation database schema.
3. Root `schema.prisma` as the original source copy. Keep it in sync if schema changes are made.
4. `README.md` for local setup commands.
5. `docs/integrations.md` for external service variables and setup steps.

If documents conflict, prefer `PROJECT_IMPLEMENTATION_SPEC.md` and `apps/api/prisma/schema.prisma`.

## Agent Operating Rules

Before each phase:

1. Run `find . -maxdepth 4 -type f | sort` to inspect current files.
2. Run `git status --short` if a Git repo has been initialized. If not, continue carefully.
3. Read the files you will edit before editing.
4. Do not overwrite unrelated user changes.
5. Keep changes scoped to the active phase.
6. After each phase, run the verification commands listed for that phase.
7. Update this `PLAN.md` only if the plan materially changes.
8. Update `docs/postman/the-feast-factory-api.postman_collection.json` whenever an API endpoint is added, changed, or removed.

Do not modify the original `.docx` or `.pdf` product documents.

## Local Environment Target

Use local PostgreSQL for now.

Default local services:

- API: `http://localhost:4000`
- API docs: `http://localhost:4000/docs`
- Customer web: `http://localhost:3000`
- Admin web: `http://localhost:3001`
- PostgreSQL database: `aranyam`

Expected local database URL:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aranyam?schema=public"
```

Adjust username/password to match the developer machine.

## Phase 0 - Preflight And Dependency Installation [COMPLETED]

Goal: make the scaffold installable and verify the base project shape.

Steps:

1. Confirm Node and npm:

```bash
node --version
npm --version
```

2. Install workspace dependencies:

```bash
npm install
```

If install fails because of network restrictions, rerun with approved network access.

3. Confirm expected workspace packages:

```bash
npm ls --workspaces --depth=0
```

4. Create local env files:

```bash
cp .env.example apps/api/.env
cp .env.example apps/customer-web/.env.local
cp .env.example apps/admin-web/.env.local
```

5. Edit `apps/api/.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aranyam?schema=public"
API_PORT=4000
API_CORS_ORIGINS="http://localhost:3000,http://localhost:3001,https://thefeastfactory.in,https://www.thefeastfactory.in,https://admin.thefeastfactory.in"
JWT_ACCESS_SECRET="replace-with-local-access-secret-min-16"
JWT_REFRESH_SECRET="replace-with-local-refresh-secret-min-16"
```

6. Edit frontend env files:

```bash
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_RAZORPAY_KEY_ID=""
```

Acceptance checks:

```bash
npm run build --if-present
npm run lint --if-present
```

## Phase 1 - Local PostgreSQL And Prisma [COMPLETED]

Goal: run the existing schema locally and seed development data.

Steps:

1. Confirm PostgreSQL is installed:

```bash
psql --version
createdb --version
```

2. Start PostgreSQL using the local method for the machine. Common macOS Homebrew command:

```bash
brew services start postgresql@16
```

If PostgreSQL is already running, skip this.

3. Create the database:

```bash
createdb aranyam
```

If it already exists, continue.

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Apply schema locally:

```bash
npm run db:push
```

6. Install database-owned `updated_at` triggers:

```bash
npm run db:triggers
```

7. Seed initial records:

```bash
npm run db:seed
```

8. Open Prisma Studio when needed:

```bash
npx prisma studio --schema apps/api/prisma/schema.prisma
```

Acceptance checks:

```bash
npm run dev:api
curl http://localhost:4000/health
```

Expected health response includes:

```json
{
  "status": "ok",
  "service": "the-feast-factory-api"
}
```

## Phase 2 - Shared Packages [IN PROGRESS]

Goal: define shared contracts once and reuse them across API, customer web, and admin web.

Implementation targets:

- `packages/shared-types/src`
- `packages/validation/src`
- `packages/api-client/src`
- `packages/design-tokens/src`

Steps:

1. Add shared domain types:
   - `UserProfile`
   - `UserAddress`
   - `MenuCategory`
   - `MenuItem`
   - `PackageSummary`
   - `PackageConfiguration`
   - `EventDraft`
   - `OrderQuote`
   - `OrderSummary`
   - `PaymentSummary`
   - `AdminOrderSummary`

2. Add Zod validation schemas:
   - Customer OTP request
   - OTP verification
   - Profile update
   - Address create/update
   - Event create/update
   - Package selection validation
   - Order quote request
   - Order create request
   - Admin login
   - Admin order status update
   - Menu/category/package admin forms

3. Add API client helpers:
   - Base `apiFetch`
   - Auth token injection
   - JSON error normalization
   - Customer API methods
   - Admin API methods

4. Add design tokens:
   - Colors
   - Spacing
   - Radius
   - Typography scale

Acceptance checks:

```bash
npm run build
```

## Phase 3 - API Foundation [IN PROGRESS]

Goal: complete production-ready NestJS foundation before business modules.

Implementation targets:

- `apps/api/src/config`
- `apps/api/src/common`
- `apps/api/src/prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`

Steps:

1. Add common response/error handling:
   - Global exception filter
   - Request logging interceptor
   - Standard API error shape

2. Add auth utilities:
   - JWT access token service
   - JWT refresh token service
   - Password hashing service
   - OTP hashing service

3. Add guards:
   - Customer JWT guard
   - Admin JWT guard
   - Role guard for `ADMIN` and `OPERATIONS`

4. Add decorators:
   - `@CurrentUser()`
   - `@CurrentAdmin()`
   - `@Roles()`

5. Add request rate limiting:
   - OTP request endpoint
   - Login endpoint
   - Payment webhook endpoint should not use the same user-facing limiter

6. Confirm Swagger works at `/docs`.

Acceptance checks:

```bash
npm run build:api
npm run dev:api
curl http://localhost:4000/health
```

## Phase 4 - Authentication And User APIs [COMPLETED]

Goal: implement customer OTP auth, admin auth, profile, and address management.

Implementation targets:

- `apps/api/src/modules/auth`
- `apps/api/src/modules/users`
- `apps/api/src/modules/admin-auth`

Customer endpoints:

- `POST /auth/customer/request-otp`
- `POST /auth/customer/verify-otp`
- `POST /auth/customer/refresh`
- `POST /auth/customer/logout`
- `GET /me`
- `PATCH /me`
- `GET /me/addresses`
- `POST /me/addresses`
- `PATCH /me/addresses/:id`
- `DELETE /me/addresses/:id`
- `POST /me/addresses/:id/default`

Admin endpoints:

- `POST /auth/admin/login`
- `POST /auth/admin/refresh`
- `POST /auth/admin/logout`

Steps:

1. [x] Implement `ConsoleOtpProvider` for local development.

2. [ ] Implement `Msg91OtpProvider` when external integrations are activated in Phase 10.

3. [x] Store OTP state in `OtpVerification`.

4. [x] Hash OTP values before storing.

5. [x] Enforce:
   - OTP expiry
   - OTP attempt limit
   - mobile number validation

6. [x] Create user on first successful OTP verification.

7. [x] Implement JWT access and refresh tokens.

8. [x] Implement admin login using `AdminUser.passwordHash`.

9. [x] Implement profile and address CRUD.

10. [x] Add implemented endpoints to the Postman collection.

Acceptance checks:

```bash
npm run build:api
curl -X POST http://localhost:4000/auth/customer/request-otp \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"9999999999"}'
```

## Phase 5 - Menu And Package APIs [COMPLETED]

Goal: implement the catalog and package configuration foundation.

Implementation targets:

- `apps/api/src/modules/menu`
- `apps/api/src/modules/packages`

Customer endpoints:

- `GET /menu/categories`
- `GET /menu/items`
- `GET /menu/items/:id`
- `GET /packages`
- `GET /packages/:id/active-version`
- `GET /package-versions/:id/configuration`
- `POST /package-versions/:id/validate-selection`
- `POST /package-versions/:id/price-selection`

Admin endpoints:

- `POST /admin/menu/categories`
- `PATCH /admin/menu/categories/:id`
- `POST /admin/menu/items`
- `PATCH /admin/menu/items/:id`
- `DELETE /admin/menu/items/:id`
- `POST /admin/packages`
- `PATCH /admin/packages/:id`
- `POST /admin/packages/:id/versions`
- `PATCH /admin/package-versions/:id`
- `POST /admin/package-versions/:id/category-rules`
- `POST /admin/package-versions/:id/menu-items`
- `POST /admin/package-versions/:id/item-pricing`

Steps:

1. [x] Customer catalog APIs return only active, non-deleted records.

2. [x] Admin APIs can manage inactive records.

3. [x] Package configuration returns:
   - Package version
   - Category rules
   - Allowed items grouped by category
   - Item pricing for selected version

4. [x] Selection validation enforces:
   - Required categories
   - Min and max selections
   - Item belongs to selected package version
   - Item is currently available for selected package version

5. [x] Pricing uses Prisma Decimal math and never JavaScript floating-point arithmetic for money.

6. [x] Added all implemented menu and package endpoints to:

```text
docs/postman/the-feast-factory-api.postman_collection.json
```

7. [x] Added idempotent sample catalog/package seed data.

Verified Phase 5 result:

```text
Silver Package base price: 499.00
Test selection customization: 60.00
Final per-plate price: 559.00
```

Acceptance checks:

```bash
npm run build:api
curl http://localhost:4000/packages
```

## Phase 6 - Event, Pricing, Order, And Payment APIs [COMPLETED]

Goal: implement the core customer transaction flow.

Implementation targets:

- `apps/api/src/modules/events`
- `apps/api/src/modules/pricing`
- `apps/api/src/modules/orders`
- `apps/api/src/modules/payments`

Customer endpoints:

- `GET /events`
- `POST /events`
- `GET /events/:id`
- `PATCH /events/:id`
- `DELETE /events/:id`
- `POST /orders/quote`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/cancel`
- `POST /orders/:id/payments/razorpay-order`
- `POST /payments/razorpay/verify`
- `POST /payments/razorpay/webhook`

Steps:

1. Event creation validates:
   - Logged-in customer
   - Address belongs to customer
   - Package version exists and is active
   - Guest count is within package rules
   - Booking lead hours from `PlatformSetting`

2. Quote endpoint:
   - Re-validates selected package/menu items server-side
   - Calculates item adjustments
   - Calculates final per-plate price
   - Calculates total amount
   - Returns full pricing breakdown

3. Order creation:
   - Creates order in `PENDING_PAYMENT`
   - Stores immutable package snapshot
   - Stores immutable selected item snapshots
   - Stores booking lead hours
   - Writes initial status history

4. Razorpay order creation:
   - Creates gateway order for stored order total
   - Stores `razorpayOrderId`
   - Does not trust frontend amount

5. Payment verification:
   - Verifies Razorpay signature
   - Marks payment `PAID`
   - Marks order `CONFIRMED`
   - Writes status history

6. Webhook handling:
   - Verifies webhook secret
   - Stores raw payload
   - Is idempotent
   - Handles payment success/failure/refund events

7. Cancellation:
   - Records actor
   - Records reason
   - Updates order status
   - Writes status history

Acceptance checks:

```bash
npm run build:api
npm run dev:api
```

Run manual API flow through Swagger at `http://localhost:4000/docs`.

Completed implementation includes event ownership/package/lead-time validation, trusted quotes, immutable order snapshots, customer cancellation, local payment mode, Razorpay order/signature integration paths, and webhook payload storage.

## Phase 7 - Admin Order And Reports APIs [COMPLETED]

Goal: enable operations/admin users to manage fulfillment.

Implementation targets:

- `apps/api/src/modules/admin-orders`
- `apps/api/src/modules/reports`

Admin endpoints:

- `GET /admin/orders`
- `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status`
- `POST /admin/orders/:id/cancel`
- `GET /admin/payments`
- `POST /admin/payments/:id/refunds`
- `GET /admin/reports/revenue`
- `GET /admin/reports/orders`
- `GET /admin/reports/payments`

Steps:

1. Add order list filters:
   - Order status
   - Payment status
   - Date range
   - Customer mobile number

2. Add valid status transition rules.

3. Add refund service abstraction:
   - Local no-op provider for development
   - Razorpay provider when configured

4. Add reports:
   - Revenue totals
   - Order counts by status
   - Payment counts by status
   - Popular menu items from order snapshots

Acceptance checks:

```bash
npm run build:api
```

Completed implementation includes filtered admin orders, validated status transitions, admin cancellation, payment/refund records, and revenue/order/payment reports.

## Phase 8 - Customer Web App [COMPLETED]

Goal: build the customer-facing responsive web flow.

Implementation targets:

- `apps/customer-web/app`
- `apps/customer-web/components`
- `apps/customer-web/lib`
- `apps/customer-web/store`

Routes:

- `/login`
- `/otp`
- `/profile`
- `/addresses`
- `/packages`
- `/packages/[packageId]`
- `/events/new`
- `/events/[eventId]`
- `/menu/select`
- `/checkout`
- `/payment/status`
- `/orders`
- `/orders/[orderId]`

State split:

- TanStack Query for server state.
- Zustand for selected package/menu builder, checkout progress, auth helpers, and UI state.
- React local state for small component interactions.

Steps:

1. Build app shell:
   - Responsive layout
   - Header/navigation
   - Auth-aware routing

2. Build login and OTP screens.

3. Build profile and address screens.

4. Build package listing and package detail screens.

5. Build event creation flow.

6. Build menu selection screen:
   - Group items by package category rules
   - Show min/max selections
   - Prevent invalid selections
   - Show premium adjustment pricing

7. Build checkout:
   - Event summary
   - Address summary
   - Menu summary
   - Server-generated quote
   - Razorpay payment start button

8. Build payment status page.

9. Build order history and order detail pages.

10. Add mobile-first QA for all screens.

Acceptance checks:

```bash
npm run build:customer
npm run dev:customer
```

Open `http://localhost:3000`.

Implemented routes include login, OTP, profile, addresses, package browsing, event creation, menu selection, checkout, local payment confirmation, order history, and order details.

### Phase 9.1 - Customer Cart And Experience Enhancement [COMPLETED]

Goal: turn the linear order builder into a resilient customer cart and improve the ordering UI before external providers are activated.

Implementation:

1. Persist package, event, guest count, and selected menu items in Zustand.
2. Add `/cart` with empty, incomplete, and checkout-ready states.
3. Reset incompatible event/menu state when a package version changes.
4. Enforce category maximums while selecting dishes.
5. Allow customers to remove dishes and resume incomplete carts.
6. Update existing draft events when customers edit cart event details.
7. Allow payment retry for an existing `PENDING_PAYMENT` order.
8. Wire real Razorpay Checkout when provider keys are configured, retaining local payment mode.
9. Refresh customer navigation and the core order journey with responsive, accessible layouts.

Acceptance checks:

```bash
npm run build:customer
npm run build:api
```

### Phase 9.2 - Public Menu And Google Maps Address Picker [COMPLETED]

Goal: let customers browse the complete menu without starting an order and select precise saved venues from Google Maps.

Implementation:

1. Add a public `/menu` catalogue using the existing menu APIs.
2. Hide menu pricing in the catalogue UI while preserving existing API and package pricing behavior.
3. Add category, search, and vegetarian/non-vegetarian filters.
4. Add Menu to desktop and mobile navigation, with Orders and Addresses shortcuts in Profile.
5. Embed Google Maps and Places API (New) search in the address page.
6. Support place search, map click, draggable pin, and explicit current-location permission.
7. Reverse-geocode selected coordinates into editable address fields.
8. Persist validated latitude and longitude using existing address columns.
9. Preserve full manual address entry when Maps or location access is unavailable.

Environment:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Acceptance checks:

```bash
npm run build:customer
npm run build:api
```

## Phase 9 - Admin Web App [COMPLETED]

Goal: build the admin portal for operations.

Implementation targets:

- `apps/admin-web/app`
- `apps/admin-web/components`
- `apps/admin-web/lib`
- `apps/admin-web/store`

Routes:

- `/admin/login`
- `/admin/dashboard`
- `/admin/orders`
- `/admin/orders/[orderId]`
- `/admin/menu/categories`
- `/admin/menu/items`
- `/admin/packages`
- `/admin/packages/[packageId]`
- `/admin/package-versions/[versionId]`
- `/admin/payments`
- `/admin/reports`
- `/admin/settings`

Steps:

1. Build admin login.

2. Build dashboard:
   - Revenue snapshot
   - Order status counts
   - Pending operations queue

3. Build order list and detail:
   - Filters
   - Status transitions
   - Cancellation form
   - Payment/refund panel
   - Status history

4. Build menu category management.

5. Build menu item management.

6. Build package management:
   - Package metadata
   - Package versions
   - Category rules
   - Allowed menu items
   - Package-specific pricing

7. Build reports screens.

8. Build settings screen for platform settings.

Acceptance checks:

```bash
npm run build:admin
npm run dev:admin
```

Open `http://localhost:3001`.

## Phase 10 - External Integrations [COMPLETED]

Goal: plug in real service providers behind already-defined environment variables.

Keep local development usable without paid external services.

### MSG91

Variables:

- `MSG91_AUTH_KEY`
- `MSG91_TEMPLATE_ID`
- `MSG91_SENDER_ID`
- `MSG91_OTP_EXPIRY_SECONDS`

Steps:

1. Create or log in to MSG91.
2. Complete sender ID/template approval.
3. Create OTP template.
4. Add values to `apps/api/.env`.
5. Keep local `ConsoleOtpProvider` available when keys are blank.

### Razorpay

Variables:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_CURRENCY`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

Steps:

1. Create or log in to Razorpay.
2. Use test mode first.
3. Copy key ID and key secret to `apps/api/.env`.
4. Copy key ID to frontend `.env.local` files.
5. Create webhook targeting `/payments/razorpay/webhook`.
6. Add webhook secret to `apps/api/.env`.
7. Test successful and failed payments.

### Google Cloud Storage

Variables:

- `GCP_PROJECT_ID`
- `GCP_STORAGE_BUCKET`
- `GOOGLE_APPLICATION_CREDENTIALS`

Steps:

1. Create GCP project.
2. Create storage bucket.
3. Create service account with limited bucket permissions.
4. Download local service account JSON.
5. Set `GOOGLE_APPLICATION_CREDENTIALS` to JSON path.
6. Use the validated admin upload endpoint for public menu images.

### Google Maps

1. Keep Maps JavaScript API, Places API (New), and Geocoding API enabled.
2. Replace the demo key before production.
3. Restrict the browser key by approved HTTP referrers and enabled APIs.

### Deferred Providers

- Resend email delivery is deferred; customer updates use in-app notifications.
- Sentry observability is deferred; it is not required for the current release.

### Production Integration Requirements

1. Razorpay reuses open payment attempts, reconciles browser callbacks, verifies raw-body webhooks, and processes payment/refund events idempotently.
2. Full and partial refunds are initiated through Razorpay and remain pending until provider confirmation.
3. MSG91 is selected only when its approved credentials are complete; console OTP remains available locally.
4. Google Cloud Storage accepts only validated JPEG, PNG, and WebP menu images up to 5 MB.
5. Missing provider credentials preserve local development fallbacks.

## Phase 10.1 - Admin Experience Enhancement [COMPLETED]

Goal: provide a responsive operations workspace rather than basic CRUD pages.

Implementation:

1. Responsive branded shell, active navigation, breadcrumbs, account controls, logout, and session refresh.
2. Reusable status badges, cards, tables, filters, dialogs, loading states, empty states, and errors.
3. Dashboard metrics, upcoming events, payment health, and operations queues.
4. Filtered order management with venue links, menu summaries, status timelines, notes, and documents.
5. Payment attempt history, failure details, and full/partial refund controls.
6. Menu image uploads and improved catalogue presentation.
7. Editable platform/business settings with integration readiness that never exposes secrets.

## Phase 10.2 - Operations Features [COMPLETED]

Goal: support day-to-day fulfilment and customer communication.

Implementation:

1. Thirty-day operations calendar and upcoming-event queue.
2. Private internal order notes with author and timestamp.
3. Customer in-app notifications with unread counts and mark-read actions.
4. Authenticated PDF payment receipts, GST invoices, and refund credit notes generated from immutable snapshots.
5. GST invoices remain disabled until legal business name, address, GSTIN, and state code are configured.
6. Milestone notifications cover confirmation, preparation, readiness, delivery, cancellation, payment failure, and refunds.
7. Email and SMS milestone notifications remain out of scope.

## Phase 11 - Automated Testing

Goal: protect core business logic and flows.

Backend tests:

- OTP request/verification
- JWT refresh
- Address CRUD authorization
- Package selection validation
- Decimal pricing calculations
- Order snapshot creation
- Razorpay signature verification
- Webhook idempotency
- Admin role authorization
- Status transition rules

Frontend tests:

- Login form
- OTP form
- Event creation
- Menu rule display
- Checkout quote display
- Order history
- Admin status update form

End-to-end tests:

- Customer creates event, selects package, checks out, and sees confirmed order.
- Admin updates order to delivered.
- Customer sees delivered status.
- Failed payment leaves order in pending payment.
- Cancellation stores reason and status history.

Suggested tooling:

- API unit/integration: Jest or Vitest
- Frontend components: Vitest + Testing Library
- E2E: Playwright

Acceptance checks:

```bash
npm test --workspaces --if-present
npm run build
```

## Phase 12 - Deployment Preparation

Goal: prepare for Vercel + Cloud Run + Cloud SQL deployment without forcing it during local development.

Steps:

1. Add Dockerfile for `apps/api`.

2. Add Cloud Run deployment notes:
   - Required env vars
   - Secret Manager mapping
   - Cloud SQL connection name
   - Service account permissions

3. Add Vercel project configuration notes:
   - `apps/customer-web`
   - `apps/admin-web`
   - Customer domain: `thefeastfactory.in`
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID`

4. Add GitHub Actions:
   - Install
   - Typecheck
   - Lint
   - Test
   - Build
   - Optional deploy jobs

5. Add migration deployment command:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Acceptance checks:

```bash
npm run build
```

## Final Definition Of Done

The project is ready for Phase 1 MVP review when:

- `npm install` succeeds from a fresh checkout.
- Local PostgreSQL setup works.
- `npm run db:push` succeeds.
- `npm run db:seed` creates usable starter data.
- `npm run dev:api` serves health and Swagger docs.
- `npm run dev:customer` serves customer web.
- `npm run dev:admin` serves admin web.
- Customer can login locally with console OTP.
- Customer can create an event.
- Customer can select a package and valid menu items.
- API returns a trusted quote.
- Customer can create an order.
- Razorpay test payment can confirm the order.
- Admin can login.
- Admin can update order status.
- Order snapshots preserve historical pricing.
- Automated tests cover critical business rules.
- External integration variables are documented.

## Open Product Decisions

Resolve these before or during implementation:

- Whether vendor management is included in Phase 1. Current Prisma schema has no vendor tables.
- Whether event type should be a first-class field. Current schema has `eventName`, not `eventType`.
- Whether carts must persist server-side. Current schema does not include a cart table.
- Whether customer refresh tokens need database-backed revocation in Phase 1.
- Whether refunds require automatic Razorpay refund calls in Phase 1 or only admin-recorded refunds.
