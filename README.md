# The Feast Factory Platform

Phase 1 base project for The Feast Factory catering and event ordering platform.

## Apps

- `apps/api`: NestJS API with Prisma and PostgreSQL
- `apps/customer-web`: Next.js customer web app
- `apps/admin-web`: Next.js admin web app

## Packages

- `packages/shared-types`: shared TypeScript types
- `packages/validation`: shared Zod schemas
- `packages/api-client`: typed fetch client helpers
- `packages/design-tokens`: shared design tokens

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env files:

```bash
cp .env.example apps/api/.env
cp .env.example apps/customer-web/.env.local
cp .env.example apps/admin-web/.env.local
```

3. Create local PostgreSQL database:

```bash
createdb aranyam
```

4. Push the Prisma schema and seed starter data:

```bash
npm run db:push
npm run db:triggers
npm run db:seed
```

5. Run the apps:

```bash
npm run dev:api
npm run dev:customer
npm run dev:admin
```

Default local URLs:

- API: `http://localhost:4000`
- API docs: `http://localhost:4000/docs`
- Customer web: `http://localhost:3000`
- Admin web: `http://localhost:3001`
- Production customer domain: `https://thefeastfactory.in`

## Customer UI and brand system

The customer experience uses a warm, premium catering palette and reusable visual patterns:

- Deep maroon `#7A1F2B` for primary actions and branded surfaces
- Gold `#C89B3C` for highlights, tags, and premium emphasis
- Warm cream `#FAF7F2` for the main canvas
- Playfair Display for editorial headings and Inter for interface copy
- Image-backed catalogue headers and ordering cards using assets in `apps/customer-web/public`
- Compact trust tags for guest range, delivery, hygiene, booking, and pricing cues
- A reusable pre-footer advantages strip for freshness, hygienic packaging, balanced meals, and timely delivery

The shared CSS tokens and component utilities live in `apps/customer-web/app/globals.css`. The home and package catalogue surfaces are implemented in `apps/customer-web/app/page.tsx`, `apps/customer-web/components/catalog/package-grid-page.tsx`, and `apps/customer-web/components/home/advantages.tsx`.

To preview the customer UI:

```bash
npm run dev:customer
```

Then open `http://localhost:3000` for the home page or `http://localhost:3000/packages` for the image-backed package catalogue.

## DB Injection & Server Startup

These steps cover what you need to inject (populate) the database and start the servers locally and for production.

- **Prerequisites:** Local PostgreSQL running (or a reachable DB). Ensure you have `psql`, `npm`, and Node available. Copy env files before running commands:

```bash
cp .env.example apps/api/.env
cp .env.example apps/customer-web/.env.local
cp .env.example apps/admin-web/.env.local
```

- **Important env vars:** set in `apps/api/.env` (or the root `.env.example`) — `DATABASE_URL`, `API_PORT`, `NEXT_PUBLIC_API_BASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and provider keys (MSG91, RAZORPAY, GCP). See [apps/api/.env](apps/api/.env) for the local example.

- **DB injection (recommended — Prisma + seed):**

1. Generate Prisma client:

```bash
npm run prisma:generate
```

2. Run migrations (development) or deploy (CI/production):

```bash
npm run db:migrate    # interactive dev migrations (uses prisma migrate dev)
npm run db:deploy     # apply migrations non-interactively (use in CI/prod)
```

3. Create triggers and auxiliary SQL (project provides a helper):

```bash
npm run db:triggers
```

4. Seed starter data:

```bash
npm run db:seed
```

These root scripts run the workspace commands for `@aranyam/api`. If you prefer, you can run the same scripts from the `apps/api` package (they exist there as well).

- **Direct SQL import (alternate):**

You can also run raw SQL files against your DB. Example (using a connection string):

```bash
psql "postgresql://user:pass@localhost:5432/dbname" -f apps/api/prisma/sql/some-file.sql
# or using Prisma's execute helper (project already uses this for triggers):
npx prisma db execute --schema=apps/api/prisma/schema.prisma --file=apps/api/prisma/sql/some-file.sql
```

- **Dev startup:**

1. Install dependencies and ensure envs are present:

```bash
npm install
# copy envs (see above)
```

2. Start services in development (run all or individually):

```bash
npm run dev            # runs all dev targets in parallel
npm run dev:api        # start only API (Nest) with watch
npm run dev:customer   # start customer Next.js (port 3000)
npm run dev:admin      # start admin Next.js (port 3001)
```

- **Production build & start:**

1. Build everything:

```bash
npm run build
```

2. Start individual services (workspace-aware):

```bash
npm run start -w @aranyam/api             # starts built Nest API (node dist/main.js)
npm run start -w @aranyam/customer-web    # starts Next.js customer app
npm run start -w @aranyam/admin-web       # starts Next.js admin app
```

Set `NODE_ENV=production` and provide production envs before starting services. Use a process manager (systemd, PM2, Docker, etc.) for long-running production processes.

**Troubleshooting:**

- If migrations fail, ensure `DATABASE_URL` is correct and the DB user has appropriate privileges.
- If you need a clean slate locally: drop and recreate the DB, then re-run migrations and seed.

## External Integration Setup

See [docs/integrations.md](docs/integrations.md) for the keys and dashboard steps needed for MSG91, Razorpay, Google Cloud Storage, and Google Maps.

## Postman

Import [docs/postman/the-feast-factory-api.postman_collection.json](docs/postman/the-feast-factory-api.postman_collection.json) to test the currently implemented health, auth, profile, and address APIs.
