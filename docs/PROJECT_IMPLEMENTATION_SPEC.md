# Catering & Event Ordering Platform - Implementation Spec

## Purpose

Build the Phase 1 MVP for a responsive web-first catering and event food ordering platform. Customers should be able to plan an event, select a package, customize menu items within package rules, place an order, pay online, and track fulfillment. Administrators should be able to manage menus, packages, orders, and operational statuses.

This document is prepared from the existing product scope documents, approved architecture document, database design PDF, and `schema.prisma`.

## Source Of Truth Decisions

- Use the approved architecture document and existing Prisma schema where older documents conflict.
- Database is PostgreSQL, not MongoDB.
- Cloud target is GCP, not AWS.
- ORM is Prisma.
- Payments use Razorpay.
- Customer authentication uses mobile OTP with JWT access and refresh tokens.
- The existing Prisma schema is the authoritative Phase 1 data model.

## Approved Stack

### Monorepo

- Nx monorepo
- TypeScript across frontend, backend, and shared packages

### Apps

- `apps/customer-web`: customer-facing responsive web app
- `apps/admin-web`: admin and operations portal
- `apps/api`: NestJS backend API

### Packages

- `packages/shared-types`: shared DTOs and generated API/domain types
- `packages/validation`: Zod schemas and shared validation rules
- `packages/api-client`: typed client for frontend apps
- `packages/design-tokens`: shared UI tokens for future mobile reuse

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- ShadCN UI
- TanStack Query
- Zustand
- React Hook Form
- Zod

State management split:

- TanStack Query handles server state, API caching, request deduplication, and mutations.
- Zustand handles client-side app state such as auth session helpers, selected package/menu builder state, checkout progress, filters, and admin UI preferences.
- React local state is still preferred for simple component-only interactions.

### Backend

- NestJS
- Node.js
- TypeScript
- Swagger / OpenAPI
- Prisma
- PostgreSQL

### Integrations

- OTP: MSG91, with Exotel as a future alternative
- Payments: Razorpay
- Email: Resend
- Error monitoring: Sentry
- Logs: Google Cloud Logging

### Infrastructure

- Customer/admin frontend hosting: Vercel
- API hosting: Google Cloud Run
- Database: Google Cloud SQL for PostgreSQL
- File storage: Google Cloud Storage
- DNS: Google Cloud DNS
- Secrets: Google Secret Manager
- CI/CD: GitHub Actions

## MVP User Roles

### Customer

- Login using mobile number and OTP
- Manage profile
- Manage saved addresses
- Create catering events
- Browse packages and menu items
- Customize menu selections
- Review calculated pricing
- Place orders
- Pay using Razorpay
- Track orders
- View order history and details

### Admin

- Login using email and password
- Manage menu categories
- Manage menu items
- Manage packages, package versions, category rules, allowed dishes, and package-specific pricing
- View and update orders
- Cancel orders with audit metadata
- View payment and refund records
- View basic revenue and order reports

### Operations

- Login using email and password
- View orders
- Update operational order statuses
- Add status history notes
- Assist with cancellations and support workflows within permission limits

## Phase 1 Customer Workflows

### 1. Customer Authentication

1. Customer enters mobile number.
2. API sends OTP through OTP provider.
3. Customer submits OTP.
4. API verifies OTP, creates user if needed, and returns JWT access and refresh tokens.
5. Customer can update profile details after login.

### 2. Address Management

1. Customer creates one or more saved addresses.
2. Customer marks a default address.
3. Addresses support home, office, event venue, and other types.
4. Event creation must use a saved address.

### 3. Event Creation

1. Customer selects or enters event details:
   - Event name or type
   - Event date
   - Event start time
   - Guest count
   - Event location
   - Special notes
2. Customer selects an active package version.
3. API validates package guest count rules.
4. Event starts as `DRAFT`.

### 4. Package And Menu Selection

1. Customer views active packages.
2. Customer selects a package version.
3. API returns package category rules:
   - Required categories
   - Minimum selections
   - Maximum selections
4. Customer selects allowed menu items within each category.
5. API validates that selections satisfy the category rules.

### 5. Pricing

Pricing must use exact decimal math and Indian Rupees.

For each selected item:

```text
adjustmentAmount = max(itemPrice - includedValue, 0)
```

For the order:

```text
totalCustomizationCharges = sum(adjustmentAmount)
finalPerPlatePrice = basePerPlatePrice + totalCustomizationCharges
totalAmount = finalPerPlatePrice * guestCount
```

Rules:

- Never use floating-point numbers for money.
- Store all amounts as `Decimal(10, 2)`.
- Store pricing snapshots at order creation.
- Never recalculate existing order prices from current master menu or package tables.

### 6. Checkout And Payment

1. Customer reviews event, address, selected menu, and pricing.
2. API creates order in `PENDING_PAYMENT`.
3. API creates Razorpay order.
4. Customer completes payment through Razorpay.
5. API verifies Razorpay signature.
6. API marks payment `PAID` and order `CONFIRMED`.
7. API writes order status history.

### 7. Order Tracking

Customer-visible statuses:

- Pending payment
- Confirmed
- In progress
- Ready for delivery
- Delivered
- Cancelled

Internal enum values:

- `DRAFT`
- `PENDING_PAYMENT`
- `CONFIRMED`
- `IN_PROGRESS`
- `READY_FOR_DELIVERY`
- `DELIVERED`
- `CANCELLED`

## Phase 1 Admin Workflows

### Menu Management

Admins can:

- Create and update menu categories
- Set category display order
- Activate or deactivate categories
- Create and update menu items
- Set menu item base price
- Mark items as vegetarian or non-vegetarian
- Upload or assign dish image URLs
- Soft-delete menu items that have order references

### Package Management

Admins can:

- Create packages such as Silver, Gold, and Premium
- Create package versions
- Set base price per plate
- Set minimum and maximum guest count
- Configure category selection rules
- Configure allowed menu items per package version
- Configure package-specific item price and included value
- Publish or deactivate package versions

Package versions are required so old orders continue to reference the commercial offer that existed when the customer ordered.

### Order Management

Admins and operations users can:

- View orders by status, payment status, customer, and date
- View selected menu item snapshots
- Update order status
- Add status transition notes
- Cancel orders
- Record cancellation actor and reason
- Review payment and refund records

### Reports

Phase 1 reports:

- Revenue report
- Order report
- Payment status report
- Popular menu items report, if data is available from order snapshots

## Data Model Summary

The existing `schema.prisma` includes:

- `User`
- `UserAddress`
- `MenuCategory`
- `MenuItem`
- `Package`
- `PackageVersion`
- `PackageCategoryRule`
- `PackageMenuItem`
- `PackageMenuItemPricing`
- `Event`
- `Order`
- `OrderSelectedItem`
- `Payment`
- `Refund`
- `AdminUser`
- `OrderStatusHistory`
- `PlatformSetting`

Important data model principles:

- Users and menu items use soft deletes where needed.
- Orders store immutable pricing and package snapshots.
- Selected order items store immutable menu item snapshots.
- Package versions preserve historical pricing and menu rules.
- Order status changes are stored in an immutable audit trail.
- Platform settings store business rules such as OTP expiry and booking lead time.

## API Modules

### Auth Module

Customer endpoints:

- `POST /auth/customer/request-otp`
- `POST /auth/customer/verify-otp`
- `POST /auth/customer/refresh`
- `POST /auth/customer/logout`

Admin endpoints:

- `POST /auth/admin/login`
- `POST /auth/admin/refresh`
- `POST /auth/admin/logout`

### Users Module

- `GET /me`
- `PATCH /me`
- `GET /me/addresses`
- `POST /me/addresses`
- `PATCH /me/addresses/:id`
- `DELETE /me/addresses/:id`
- `POST /me/addresses/:id/default`

### Menu Module

Customer endpoints:

- `GET /menu/categories`
- `GET /menu/items`
- `GET /menu/items/:id`

Admin endpoints:

- `POST /admin/menu/categories`
- `PATCH /admin/menu/categories/:id`
- `POST /admin/menu/items`
- `PATCH /admin/menu/items/:id`
- `DELETE /admin/menu/items/:id`

### Packages Module

Customer endpoints:

- `GET /packages`
- `GET /packages/:id/active-version`
- `GET /package-versions/:id/configuration`
- `POST /package-versions/:id/validate-selection`
- `POST /package-versions/:id/price-selection`

Admin endpoints:

- `POST /admin/packages`
- `PATCH /admin/packages/:id`
- `POST /admin/packages/:id/versions`
- `PATCH /admin/package-versions/:id`
- `POST /admin/package-versions/:id/category-rules`
- `POST /admin/package-versions/:id/menu-items`
- `POST /admin/package-versions/:id/item-pricing`

### Events Module

- `GET /events`
- `POST /events`
- `GET /events/:id`
- `PATCH /events/:id`
- `DELETE /events/:id`

### Orders Module

Customer endpoints:

- `POST /orders/quote`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/cancel`

Admin endpoints:

- `GET /admin/orders`
- `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status`
- `POST /admin/orders/:id/cancel`

### Payments Module

- `POST /orders/:id/payments/razorpay-order`
- `POST /payments/razorpay/verify`
- `POST /payments/razorpay/webhook`
- `GET /admin/payments`
- `POST /admin/payments/:id/refunds`

### Reports Module

- `GET /admin/reports/revenue`
- `GET /admin/reports/orders`
- `GET /admin/reports/payments`

## Frontend Routes

### Customer Web

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

### Admin Web

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

## Validation Rules

- Mobile number must be valid for OTP login.
- OTP must expire based on `PlatformSetting.otp_expiry_seconds`.
- OTP attempts must be limited based on `PlatformSetting.otp_max_attempts`.
- Guest count must be greater than or equal to package version minimum guest count.
- Guest count must not exceed package version maximum guest count when configured.
- Event date must satisfy `PlatformSetting.min_booking_lead_hours`.
- Menu selection must satisfy all mandatory package category rules.
- Menu item must belong to the selected package version.
- Payment amount must match the stored order amount.
- Razorpay signatures must be verified server-side.
- Order status transitions must be validated and audited.

## Security Requirements

- HTTPS only in production.
- JWT access tokens and refresh tokens.
- Hash admin passwords using a strong password hashing algorithm.
- Rate-limit OTP and authentication endpoints.
- Validate all request payloads.
- Use CORS allowlists.
- Store secrets outside source code.
- Verify Razorpay webhooks.
- Never trust frontend-calculated prices.
- Restrict admin endpoints by role.

## Initial Seed Data

Seed these records for local development:

- Admin user with `ADMIN` role
- Operations user with `OPERATIONS` role
- Platform settings:
  - `min_booking_lead_hours = 48`
  - `otp_expiry_seconds = 300`
  - `otp_max_attempts = 5`
  - `razorpay_currency = INR`
- Menu categories:
  - Starters
  - Main Course
  - Desserts
  - Beverages
  - Snacks
- Sample menu items for each category
- Sample Silver, Gold, and Premium packages
- One active package version per package
- Package category rules
- Package menu item pricing

## Implementation Order

1. Create Nx monorepo structure.
2. Add NestJS API app.
3. Add Prisma configuration using the existing schema.
4. Add database migrations and seed script.
5. Add shared validation and shared types packages.
6. Implement authentication module.
7. Implement user and address module.
8. Implement menu and package modules.
9. Implement event module.
10. Implement pricing service.
11. Implement order creation with immutable snapshots.
12. Implement Razorpay payment flow and webhook verification.
13. Implement admin authentication and role guards.
14. Implement admin menu/package/order screens.
15. Implement customer package, menu selection, checkout, and order tracking screens.
16. Add reports endpoints and admin report pages.
17. Add unit, integration, and end-to-end tests.
18. Add deployment configuration.

## Testing Checklist

Backend:

- Auth OTP request and verification
- JWT refresh flow
- Address CRUD
- Package selection validation
- Pricing calculations with decimal precision
- Order snapshot creation
- Razorpay signature verification
- Webhook idempotency
- Order status transitions
- Admin role authorization

Frontend:

- Mobile login flow
- Event creation flow
- Package browsing
- Menu rule validation
- Checkout summary
- Payment status handling
- Order history
- Admin order status update
- Admin menu and package management forms

End-to-end:

- Customer creates event, selects package, pays, and sees confirmed order
- Admin updates order from confirmed to delivered
- Customer sees updated order status
- Failed payment keeps order in pending payment state
- Cancelled order records cancellation metadata and status history

## Known Scope Gaps To Resolve

- Vendor management appears in the product scope, but the current approved database schema does not include vendor entities or order-vendor assignment. Treat vendor management as out of Phase 1 implementation unless the schema is extended.
- Older documents mention MongoDB and AWS. Use PostgreSQL and GCP because those are in the approved architecture and current Prisma schema.
- Event type is mentioned in product scope, but the current schema has `eventName` rather than an explicit event type enum/table. Decide whether to add `eventType` before implementation.
- Cart persistence is mentioned conceptually, but the schema creates events and orders without a separate cart table. Use frontend/client state for Phase 1 unless persistent saved carts are required.

## Definition Of Done

- Customer web, admin web, and API apps run locally.
- PostgreSQL schema migrates successfully from Prisma.
- Seed data allows a full demo checkout flow.
- API exposes Swagger documentation.
- Customer can complete event creation, package selection, menu customization, checkout, payment verification, and order tracking.
- Admin can manage menus, packages, and order statuses.
- Pricing snapshots are stored and remain stable after menu/package changes.
- Automated tests cover core business rules.
- Environment variables are documented.
- Deployment configuration exists for Vercel and Google Cloud Run.
