---
name: feastfactory-regression
description: Audit FeastFactory business flows, validations, state transitions, and regression risk across the API, customer web, admin web, database, and external integrations. Use for end-to-end test planning, release regression runs, corner-case analysis, and evidence-based test reports in this repository.
---

# FeastFactory Regression

Produce a release decision backed by executed evidence. Do not treat code inspection, compilation, or an older report as a passing runtime test.

## Scope the system

Read the current implementation before relying on documentation. Build the flow map from:

- `apps/api/src/modules`, DTOs, guards, Prisma schema, migrations, and API tests;
- customer routes, local/session stores, and API calls;
- admin routes, role-gated actions, region scoping, and API calls;
- shared contracts, validation, and API-client behavior;
- provider boundaries for OTP, payments, maps, storage, notifications, and PDF documents.

Preserve the important aggregate boundaries:

- one cart session may contain several package carts;
- checkout creates one booking with package-level child orders;
- delivery and cutlery are booking-level shared charges;
- payments belong to the booking and are allocated to child orders;
- approval, decline, cancellation, refund, fulfilment, and document generation must remain consistent across the booking and its children;
- persisted order, menu, address, pricing, and payment facts are snapshots and must not drift when catalogue data changes.

## Test each flow

For every material business flow, cover the happy path and the relevant failure classes:

1. Authentication and ownership: unauthenticated, wrong principal type, deactivated account, wrong customer, wrong region, and wrong admin role.
2. Input boundaries: required/optional/null, empty and whitespace-only strings, exact min/max, just below/above bounds, malformed UUID/date/time/phone/email/decimal, duplicates, and oversized arrays/files.
3. State transitions: allowed transition, repeated request, stale/concurrent request, backward transition, terminal state, and mixed child state.
4. Money and quantity: zero, negative, smallest accepted value, maximum persisted value, decimal precision, rounding, overflow, overpayment, allocation sums, refund sums, and shared-charge duplication.
5. Time and location: IST conversion, lead-time boundary, closed kitchen, overlapping regions, unavailable package/dish, invalid coordinates, and delivery-service/helper rules.
6. Retry safety: duplicate callbacks, out-of-order webhooks, provider timeouts, uncertain responses, reused gateway orders, refresh/logout replay, and import/update retries.
7. Data lifecycle: soft delete, default promotion, historical snapshot reads, catalogue deactivation, migration/backfill safety, purge boundaries, and orphan prevention.

Prefer existing deterministic suites. Add a focused test only when the request includes implementation or when a demonstrated gap must be reproduced. Never mutate production data. Use isolated test identities and clean up only records created by the audit.

## Standard verification

Run the applicable commands from the repository root:

```bash
npm run test:api
npm run test:client
npm run test:business
npm run test:contracts
npm run contracts:check
npm run lint
npm run build
```

Run the database-backed KG gate explicitly when a local or authorized test database is configured:

```bash
KG_DATABASE_TEST=1 npm run test:api
```

If a command cannot run, record the exact environmental blocker and continue with independent checks. For database-backed verification, confirm the target is a local or explicitly authorized non-production database before writes.

Exercise live customer/admin flows only when the applications, test credentials, and required provider sandbox are available. Do not mark Razorpay, OTP delivery, maps, object storage, notifications, responsive layout, keyboard access, or browser behavior as passed solely because mocks, source, or builds succeed.

For a Razorpay local test-mode run:

- verify the configured key ID is a test key without printing either key or secret;
- use a new isolated test mobile/customer and refuse to reuse an existing identity;
- use a process-only OTP bypass in non-production and disable outbound SMS for that process;
- create the address/cart/quote through public API paths, then create the provider order through the application endpoint;
- verify an invalid payment signature is rejected;
- sign webhook fixtures with a temporary non-production webhook secret, verify first delivery and duplicate idempotency, and confirm the persisted attempt/payment state;
- distinguish this from interactive Razorpay Checkout capture, a provider-originated webhook, key rotation, and provider refund settlement—report each separately;
- remove only records created by the run and verify cleanup counts are zero.

During live error-path testing, compare the client response status with the structured HTTP log status. A mismatch is an observability failure even when the client behavior is correct.

## Report results

Write the report at the repository root with the audit date in the filename (`REGRESSION_TEST_REPORT_YYYY-MM-DD.md`); `docs/*` is ignored in this repository. Include:

- release verdict and counts by evidence status;
- system/flow map and validation ownership;
- one case matrix covering happy paths and corner cases;
- automated command results with pass/fail/skip counts;
- defects and gaps ordered by severity;
- provider, browser, data, and environment limitations;
- a minimal rerun checklist.

Use only these result labels:

- `PASS` — the stated behavior was executed successfully in this audit;
- `FAIL` — execution contradicted the expected behavior;
- `REVIEWED` — source/contracts were inspected, but the behavior was not executed end to end;
- `BLOCKED` — execution was attempted but an environmental dependency prevented a result;
- `NOT COVERED` — no adequate executable or inspection evidence was found.

Each case row must contain an ID, layer/flow, scenario, expected result, evidence, status, and release impact. Split broad scenarios when their evidence or status differs. Call out skipped tests separately; a skipped test is not a pass.

End with a clear `GO`, `CONDITIONAL GO`, or `NO-GO`. A green build is not sufficient for `GO` when critical payment, authorization, booking consistency, or customer/admin completion paths remain unexecuted.
