# The Feast Factory Platform

The Feast Factory is a database-backed catering and meal-box ordering platform. It includes a public customer experience, an operations/admin console, and a NestJS API backed by PostgreSQL and Prisma.

## Workspace

- `apps/api` — NestJS API, Prisma schema, migrations, pricing, cart, order, payment, and operations services
- `apps/customer-web` — Next.js customer catalogue, menu builders, unified cart/event/payment flow, account, and order history
- `apps/admin-web` — Next.js administration for catalogue, offerings, settings, orders, and operations
- `packages/shared-types` — shared API types, enums, labels, and generated contracts
- `packages/api-client` — typed request helpers
- `packages/validation` — shared validation schemas
- `packages/design-tokens` — shared design tokens

## Current customer flow

- Guests can browse packages, meal boxes, package details, and menus, and can prepare a local draft.
- Authentication is required before a draft is persisted to the account cart, and before profile, address, checkout, payment, or order routes are used.
- Logout clears session-bound browser state without deleting the authenticated customer's saved database cart.
- If a guest draft and an account cart both exist after sign-in, the customer chooses which one to continue.
- Package details open in a responsive dialog/bottom sheet. Legacy `/packages/[packageId]` links redirect to the appropriate catalogue and reopen those details.
- `/menu/select` presents included, fixed, swappable, swapped, extra, and selected states with package-specific rules.
- Meal boxes allow configured swaps only; fixed packages expose configured extras; custom packages use the visual builder.
- `/cart` is the canonical event, venue, menu-review, quote, and payment page. Legacy `/checkout` links redirect to it.

## Data provenance

Customer-visible catalogue and transactional facts are supplied by PostgreSQL through the API:

- Package names, rules, guest limits, versions, prices, images, and badges
- Ordering-offering content, images, CTA labels, and display order
- Menu categories, menu items, dietary data, availability, and item images
- Booking lead time, service hours, time-slot interval, and public business settings
- Server-authoritative package preview quotes and authenticated cart quotes
- Cart, order, payment, status, document, delivery-fee, and selected-item snapshots

`MenuItem.imageUrl` is the only dish-image source. When it is empty, the customer UI deliberately shows one neutral branded placeholder; accurate item images should be uploaded through admin rather than inferred from names, IDs, or categories.

Presentation-only copy, icons, route labels, empty states, and decorative brand imagery remain code-controlled.

## Brand and customer UI

The customer web app uses the Feast Factory visual system:

- Maroon `#7A1F2B` for primary actions and branded surfaces
- Gold `#C89B3C` for highlights and premium emphasis
- Warm cream `#FAF7F2` for the main canvas
- Playfair Display for editorial headings and Inter for interface copy
- Compact menu rows, clear state labels, collapsible category/filter navigation, and responsive sticky summaries

Shared styles and tokens are in `apps/customer-web/app/globals.css`. Catalogue media is served from `apps/customer-web/public`, while the selected asset path is stored in the database.

## Local setup

Prerequisites: Node.js, npm, PostgreSQL, and `psql`.

1. Install dependencies:

```bash
npm install
```

2. Create local environment files and fill in the required secrets/provider keys:

```bash
cp .env.example apps/api/.env
cp .env.example apps/customer-web/.env.local
cp .env.example apps/admin-web/.env.local
```

The important values include `DATABASE_URL`, `API_PORT`, `NEXT_PUBLIC_API_BASE_URL`, JWT secrets, and the configured MSG91, Razorpay, Google Cloud, and Google Maps credentials. See [integration setup](docs/integrations.md) for provider details.

3. Create the local database, generate Prisma, apply migrations, create auxiliary triggers, and seed starter records:

```bash
createdb feastfactory
npm run prisma:generate
npm run db:deploy
npm run db:triggers
npm run db:seed
```

Use `npm run db:migrate` only while authoring a new development migration. Existing environments should use `npm run db:deploy`; avoid `db:push` for normal setup because it bypasses migration history.

4. Start services individually to keep local memory use predictable:

```bash
npm run dev:api
npm run dev:customer
npm run dev:admin
```

`npm run dev` starts all three through Nx when that is preferable.

Default URLs:

- Customer web: `http://localhost:3000`
- Admin web: `http://localhost:3001`
- API: `http://localhost:4000`
- Swagger: `http://localhost:4000/docs`

## Catalogue presentation migration

Migration `20260702000000_catalog_presentation_and_public_rules` adds database-managed package/offering images and labels and seeds the event service window:

- `packages.image_url` and `packages.badge_label`
- `ordering_offerings.image_url` and `ordering_offerings.cta_label`
- `event_service_start_time`, `event_service_end_time`, and `event_time_interval_minutes` platform settings

Migration `20260704000000_public_business_settings` creates empty, admin-editable business identity and support keys. Empty values remain visibly unavailable until real details are entered; the API never substitutes fabricated phone, address, email, or GST information.

Migration `20260704010000_database_auth_rate_limits` adds shared authentication rate-limit buckets. OTP request/verification and admin-login limits are enforced atomically in PostgreSQL across all API replicas; OTP consumption is also a conditional, single-use transaction.

The backfill sets current curated paths only when the corresponding value is empty, so later admin edits are not overwritten. Apply it with:

```bash
npm run db:deploy
```

The admin package and offering controls can maintain these values after deployment.

## Public catalogue interfaces

- `GET /catalog/public-settings` — booking lead time, event service window, slot interval, and public business information
- `GET /catalog/ordering-offerings` — active ordering choices and their database-managed presentation
- `GET /packages` — active packages and versions
- `GET /package-versions/:id/configuration` — included items, swaps, extras, and category rules
- `POST /package-versions/:id/preview-quote` — public, server-authoritative preview estimate
- `/cart/*` — authenticated persistence and final quote operations

Generated API types live in `packages/shared-types/src/generated-api.ts`. Regenerate and verify them after controller contract changes:

```bash
npm run contracts:generate
npm run contracts:check
```

## Validation and production build

```bash
npm run lint
npm run build
npm run contracts:check
npm run test:contracts
```

Individual targets are available as `build:api`, `build:customer`, and `build:admin`, along with each workspace's lint command.

To start built services:

```bash
npm run start -w @aranyam/api
npm run start -w @aranyam/customer-web
npm run start -w @aranyam/admin-web
```

Set production environment variables and use a supervised process manager or deployment platform for long-running services.

## API testing

Import [the Postman collection](docs/postman/the-feast-factory-api.postman_collection.json) and follow the [Postman flow guide](docs/postman/README.md). Swagger at `/docs` remains the current source for the complete generated endpoint surface.

## Troubleshooting

- Confirm PostgreSQL is running and `DATABASE_URL` points to the intended database and schema.
- Use `npm exec prisma migrate status -- --schema=apps/api/prisma/schema.prisma` to inspect migration state.
- Run `npm run prisma:generate` after changing `schema.prisma`.
- Missing dish images are not a migration failure: upload the accurate image in admin and the customer UI will stop using the neutral placeholder.
