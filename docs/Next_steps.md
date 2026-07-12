# Product roadmap and production readiness

This document tracks work that is not already represented by the current codebase. For the implemented architecture and local setup, see the repository [README](../README.md).

## Implemented baseline

- Database-persisted customer carts, guest draft reconciliation, server-authoritative quotes, checkout, payments, and order history
- Admin management for menu categories/items, CSV menu import, packages and package versions, catalogue presentation, orders, payments, platform settings, and operating regions
- Menu-item and catalogue image upload through the admin panel, backed by the configured object-storage provider
- Customer About, FAQ, Contact, profile, address, policy, and account flows
- Fixed-package extras, configured meal-box swaps, custom-package selection, delivery-fee calculation, refunds, and order documents
- PostgreSQL-backed authentication rate limiting and single-use OTP verification
- Generated OpenAPI contracts, shared frontend types, linting, production builds, and API/client/business-rule tests

## Product priorities

1. Add customer self-service rescheduling with availability, lead-time, repricing, and operations approval rules.
2. Add saved favourites and one-click reorder from a previous event, with current-price and availability reconciliation.
3. Add live order milestones and proactive SMS/WhatsApp notifications for payment, confirmation, preparation, dispatch, and completion.
4. Add coupon, referral, loyalty-credit, and gift-card support with a server-owned promotion rules engine.
5. Add event collaboration so a customer can invite another person to review the menu and approve selections.
6. Add dietary/allergen profiles and surface warnings during package and menu selection.
7. Add customer ratings and structured post-event feedback tied to fulfilled orders.

## Engineering and production readiness

- Add CI gates for lint, build, contract drift, API tests, API-client tests, migration validation, and business-rule verification.
- Add browser end-to-end coverage for guest browsing, OTP sign-in, cart reconciliation, package configuration, checkout, payment callbacks, admin package editing, and refunds.
- Define the production topology for Cloud Run, Cloud SQL, object storage/CDN, secrets, DNS, TLS, firewall rules, backups, and disaster recovery.
- Add application monitoring: structured logs, request correlation IDs, error reporting, latency/error dashboards, payment-webhook alerts, and database capacity alerts.
- Run load and concurrency tests for OTP, quote, cart mutation, checkout, payment webhook, and refund paths.
- Review database indexes using production-like query plans and traffic data; avoid speculative indexes without measured queries.
- Add dependency/security scanning, secret scanning, container image scanning, and a documented release/rollback procedure.
- Complete accessibility testing and performance budgets for both web applications.

## External configuration before launch

- Production MSG91 credentials, approved templates, sender IDs, and delivery monitoring
- Razorpay live keys, webhook secret, callback/webhook allowlists, and end-to-end reconciliation checks
- Restricted Google Maps production key with billing and quota alerts
- Cloudflare R2 bucket credentials, public domain, CORS policy, lifecycle policy, and backup expectations
- Rotated production JWT secrets stored in the deployment secret manager
- Verified business identity, GST, support, invoice, tax, and legal-footer values in platform settings

Never commit production credentials to this repository. Environment-specific values belong in the deployment secret manager.
