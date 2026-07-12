# The Feast Factory — go-live readiness

> Revalidated against the codebase on July 12, 2026.

This is a deployment checklist, not an implementation inventory. The current product surface is documented in the repository [README](../README.md), and future product work is tracked in [Product roadmap and production readiness](Next_steps.md).

## Current application baseline

The repository contains a buildable customer application, admin/operations application, NestJS API, PostgreSQL/Prisma data model, generated OpenAPI contracts, and shared packages. The customer application includes persisted carts, package/menu configuration, server-authoritative quotes, checkout/payment, order history/details, About, FAQ, Contact, Terms, Privacy, and Cancellation Policy pages. Its shell includes legal/support footer navigation. The admin application includes catalogue and image management, orders, payments, reports/dashboard, settings, and operating-region controls.

Development fallbacks are intentional for local use. Production environment validation must reject unsafe or missing provider configuration; do not assess production readiness from local fallback behaviour alone.

## Required external configuration

| Integration | Production requirement |
| --- | --- |
| MSG91 | Live authentication key, approved OTP template and sender ID; verify delivery and failure handling on real devices. |
| Razorpay | Live key pair, webhook secret, public webhook URL, allowed domains, and reconciliation monitoring. |
| Google Maps | Billing-enabled, origin/API-restricted browser key with quota alerts. |
| Cloudflare R2 | Bucket credentials, public base URL, CORS, lifecycle policy, and an explicit backup/recovery expectation. |
| JWT | Independently generated access/refresh secrets stored in the deployment secret manager and covered by rotation procedure. |
| Business settings | Verified legal name, address, GST/PAN, tax rates, support contacts, logo, document prefixes, and invoice footer. |

Email notifications, Sentry, and Google Cloud Logging are roadmap capabilities, not dependencies that should be described as already implemented.

## Release gates

Run these commands from the repository root on the exact revision being deployed:

```bash
npm ci
npm run prisma:generate
npm run lint
npm run build
npm run test:contracts
npm run contracts:check
npm run test:api
npm run test:client
npm run test:business
npm run db:deploy
npm run db:triggers
```

Additionally:

- Verify `prisma migrate status` reports no pending or failed production migration.
- Exercise OTP, guest/account cart reconciliation, quote, checkout, Razorpay callback/webhook, refund, and document download in staging.
- Verify admin role and operating-region restrictions with ADMIN and OPERATIONS accounts.
- Test upload delivery through the production R2 public domain and CORS policy.
- Confirm Terms, Privacy, Cancellation Policy, support contacts, and business identity contain approved production copy rather than placeholders.
- Confirm database backups, point-in-time recovery, deployment rollback, and secret rotation are documented and rehearsed.

## Important remaining product gaps

- Customer self-service cancellation/rescheduling rules and refund visibility should be explicitly product-defined and tested before being promised.
- Admin password recovery and admin-user management are not part of the current primary admin surface.
- Customer notifications are presently OTP/payment-flow oriented; full lifecycle email/WhatsApp messaging remains future work.
- Reporting needs date filters and export capabilities for operational use at scale.
- Browser end-to-end, accessibility, load, and failure-injection coverage should be added before high-volume launch.

## Launch decision

Code compilation alone is not a go-live approval. Release only after the automated gates pass, migrations are clean, live-provider staging checks pass, legal/business content is approved, and monitoring/rollback owners have signed off.
