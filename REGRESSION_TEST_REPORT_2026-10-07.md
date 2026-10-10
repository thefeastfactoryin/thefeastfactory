# FeastFactory end-to-end regression report

**Audit date:** 7 October 2026  
**Scope:** customer web, admin web, NestJS API, shared packages, PostgreSQL business rules, booking/payment aggregate, and provider boundaries  
**Skill used:** `skills/feastfactory-regression/SKILL.md`  
**Verdict:** **CONDITIONAL GO**

## Executive result

The implemented API and database business rules are broadly healthy. The complete API suite, including the database-backed KG scenario, passed all 129 cases; the API client passed all 9 cases; database business-rule verification, contract checks, lint, and all three production builds passed. Public customer catalogue and package-detail flows also passed a live desktop/mobile smoke test against the local API.

An isolated local checkout run also authenticated a new test customer, created an address and fixed-package cart, obtained the server quote, and created a real Razorpay **test-mode** order. The API rejected an invalid verification signature, accepted a correctly HMAC-signed `payment.failed` webhook, treated its replay as a duplicate, and persisted the checkout attempt as `FAILED`. All records created by the run were removed afterward.

The release is not an unconditional GO because:

1. There is no browser automation suite for authenticated customer checkout or admin operations. The authenticated journey was exercised through HTTP, but a real browser was not used to complete Razorpay Checkout, approve a booking, collect/refund money, or complete fulfilment in this audit.
2. Razorpay test-mode order creation and webhook handling passed, but actual Checkout capture, provider-originated webhook delivery, key rotation, and refund settlement remain unexecuted.
3. MSG91 delivery, Maps geocoding, cloud storage, notifications, and generated PDF download still need a sandbox/staging run with provider credentials.

### Case totals

| PASS | FAIL | REVIEWED | BLOCKED | NOT COVERED | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 86 | 0 | 10 | 7 | 3 | 106 |

## Evidence labels

- **PASS** — executed successfully during this audit.
- **FAIL** — execution contradicted the expected result.
- **REVIEWED** — implementation/contracts inspected, but not executed end to end.
- **BLOCKED** — execution was attempted but a dependency prevented a result.
- **NOT COVERED** — no adequate executable or inspection evidence was found.

## Business-flow map

```text
Guest catalogue
  -> location / kitchen resolution
  -> OTP authentication
  -> saved address
  -> one cart session with one or more package carts
  -> package-type selection rules and server quote
  -> FULL / HALF / PAY_LATER checkout
  -> one booking + child package orders
  -> booking-owned payment ledger + child allocations
  -> kitchen approval or decline/refund
  -> fulfilment progression
  -> customer/admin reads, documents, reports
```

The critical invariants are implemented at the API/database layer: all child carts must share booking details; delivery and cutlery are charged once; prices and menu selections are snapshotted; payment/refund callbacks are idempotent; approval/decline/cancellation are aggregate actions; fulfilment only moves forward; and Operations access is region-scoped.

## Validation ownership

| Layer | Current responsibility | Audit result |
| --- | --- | --- |
| Customer web | Input affordances, shared Zod address/mobile validation, cart completion prompts, safe return paths, payment-window error handling | REVIEWED; public desktop/mobile smoke PASS; authenticated completion not executed |
| Admin web | Required fields, import preview, action-state disabling, package configuration forms, fulfilment/payment controls | REVIEWED; login responsive smoke PASS; authenticated actions not executed |
| API DTOs | UUIDs, enums, dates, numbers, bounds, lengths, arrays, URLs, phone/email and decimal formats | PASS for covered automated cases; many DTO boundaries lack endpoint-level tests |
| API services | Ownership, package rules, availability, lead time, quote consistency, state transitions, idempotency and concurrency | PASS across the main automated suite |
| PostgreSQL/Prisma | Relations, uniqueness, immutable snapshots, aggregate ownership, migrations and selected constraints | PASS, including guarded KG persistence and seven live integrity queries |
| Providers | OTP, payments, maps, storage, notifications, PDFs | Mocked/reviewed locally; staging execution remains BLOCKED |

## Case report

### Authentication, authorization and API hardening

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| AUTH-01 | Valid customer OTP is single-use and creates/returns the customer session. | Auth service and concurrency tests. | PASS | Critical |
| AUTH-02 | Invalid, expired, or over-attempt OTP is rejected. | DTO/service review; invalid/claim concurrency tests. | PASS | Critical |
| AUTH-03 | Failed MSG91 delivery removes the undelivered verification record. | `auth-otp-robustness.test.ts`. | PASS | High |
| AUTH-04 | Ambiguous HTTP 200, application error, and HTTP failure from MSG91 are rejected. | Five provider-adapter cases. | PASS | High |
| AUTH-05 | OTP/admin/payment rate limits use shared DB buckets and return retry timing. | Scaling tests. | PASS | High |
| AUTH-06 | Test OTP bypass is rejected in production and scoped to one configured mobile in non-production. | Hardening/scaling tests. | PASS | Critical |
| AUTH-07 | Deactivated customers are rejected immediately even with an existing access token. | JWT principal-state test. | PASS | Critical |
| AUTH-08 | Admin role and assigned region are re-read from the database instead of trusted from stale token claims. | JWT principal-state test. | PASS | Critical |
| AUTH-09 | Customer and admin protected endpoints reject anonymous requests. | Live `GET /cart/all` and `GET /admin/bookings` returned 401. | PASS | Critical |
| AUTH-10 | External/open redirects in `returnTo` are rejected. | API-client safe-return-path tests. | PASS | High |
| AUTH-11 | Refresh/logout replay and token-family invalidation across multiple devices. | Refresh implementation reviewed; no dedicated replay integration case found. | NOT COVERED | High |
| AUTH-12 | Security headers are present and Swagger cannot be enabled in production. | Automated hardening tests; production header smoke was not stable across the isolated shell. | PASS | High |
| AUTH-13 | Failed requests are logged with their actual HTTP status rather than the controller's default success status. | Live invalid Razorpay signature exposed a logged 201 for an actual 400; interceptor fixed and three regression cases pass. | PASS | High |

### Profile and address management

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| ADDR-01 | Profile name/email enforce type, maximum length and valid email. | DTO inspection and build. | REVIEWED | Medium |
| ADDR-02 | Address requires line 1, city, state and a six-digit pincode; lat/long use geographic validators. | Shared Zod and API DTO inspection. | REVIEWED | High |
| ADDR-03 | A customer cannot update/delete/use another customer's address. | Ownership filters inspected; cart checkout revalidates user ownership. | REVIEWED | Critical |
| ADDR-04 | Address referenced by a cart is soft-deleted rather than breaking historical/current references. | Address test. | PASS | High |
| ADDR-05 | Deleting the default promotes another address atomically; direct default unsetting is blocked. | Address tests. | PASS | High |
| ADDR-06 | Deleted address is rejected at final checkout even if the browser retained its ID. | Checkout query filters and error path inspected; not executed through endpoint. | REVIEWED | High |

### Catalogue, menu, package and region administration

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| CAT-01 | Public catalogue returns only active offerings/packages in display order. | Automated catalogue tests and live 11-package response. | PASS | High |
| CAT-02 | Public package detail displays current included menu and commercial limits. | Live desktop package-detail modal. | PASS | High |
| CAT-03 | Menu item price formats reject negative/unsafe precision; URL/text lengths are bounded. | DTO/import tests. | PASS | High |
| CAT-04 | CSV import rejects missing/invalid rows, caps at 1,000, and skips exact matches without writes. | Admin preview inspection and API tests. | PASS | Medium |
| CAT-05 | Changing a menu item's category reconciles package compositions. | Automated category-sync test. | PASS | High |
| CAT-06 | Replacing a package composition is atomic and rejects wrong-category items, duplicates, and invalid roles. | Composition tests and DTO review. | PASS | Critical |
| CAT-07 | Publishing type rules: KG/custom base price and role constraints; meal box requires included items. | Service validation inspection and KG tests. | PASS | Critical |
| CAT-08 | Package/dish availability is scoped to the selected region and closed kitchens are rejected. | Pricing/region tests. | PASS | Critical |
| CAT-09 | Operations can change only their assigned kitchen availability. | Region authorization test. | PASS | Critical |
| CAT-10 | Upload rejects missing file, unsupported MIME and files above 5 MB. | Storage service inspected; no multipart endpoint test. | REVIEWED | Medium |
| CAT-11 | Cloud upload success, object ACL/URL behavior and unavailable storage provider. | No configured storage integration run. | BLOCKED | Medium |

### Cart, delivery and checkout preparation

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| CART-01 | Same package may be added twice as independent carts. | Cart test. | PASS | Medium |
| CART-02 | Cart quantity stays within package min/max and carts update independently. | Cart tests/service guards. | PASS | High |
| CART-03 | KG carts ignore guest count and portion packages reject weight fields. | KG unit/integration tests. | PASS | High |
| CART-04 | Item replacement targets only the requested owned cart. | Cart test. | PASS | Critical |
| CART-05 | Address/date/time/contact/delivery changes synchronize across all carts in one session. | Service inspection; shared-detail guard; guarded KG flow exercises contact synchronization. | REVIEWED | Critical |
| CART-06 | Mixed carts with mismatched address, region, schedule, contact or delivery mode are rejected before payment. | `assertSharedBookingDetails` inspection; no endpoint-level negative case. | REVIEWED | Critical |
| CART-07 | Active carts persist despite stale expiry timestamps; only abandoned/expired carts older than 30 days purge. | Cart lifecycle tests. | PASS | High |
| CART-08 | Removing one package leaves the remaining booking delivery details intact. | Cart test. | PASS | Medium |
| CART-09 | Notes are trimmed, blank notes become null and maximum length is 1,000. | Cart test and DTO. | PASS | Medium |
| CART-10 | Invalid/missing coordinates, out-of-area location, closed kitchen and availability-check failures block checkout. | API tests/service review; live invalid-coordinate request returned 400. | PASS | Critical |
| CART-11 | Overlapping service areas choose an available kitchen; unavailable covering kitchen is reported. | Region tests. | PASS | High |
| CART-12 | Doorstep/assisted fees and helper count rules are applied server-side. | Region pricing tests/service validation. | PASS | High |
| CART-13 | Cutlery accepts only active configured IDs, rejects duplicates/excessive quantity and prices selections independently. | Cutlery tests/service review. | PASS | High |
| CART-14 | Concurrent cart mutation between quote and payment is detected by fingerprint and locked recheck. | Implementation reviewed; no explicit concurrent endpoint test. | REVIEWED | Critical |

### Pricing and package-type corner cases

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| PRICE-01 | Multi-package subtotal sums children while delivery and booking cutlery are charged once. | Cart quote/payment snapshot tests. | PASS | Critical |
| PRICE-02 | FULL uses total; HALF is calculated once from the final aggregate; PAY_LATER creates no gateway charge. | Checkout attempt tests. | PASS | Critical |
| PRICE-03 | Fixed extras use selected quantity and may exceed guest count. | Extra-quantity tests. | PASS | High |
| PRICE-04 | Fixed included item swaps remain within category; replacement may also be bought as an extra. | Swap tests. | PASS | High |
| PRICE-05 | Custom packages reject non-allowlisted active items; legacy empty allowlists retain fallback behavior. | Authorization/fallback tests. | PASS | Critical |
| PRICE-06 | KG requires an explicit allowlist and at least one dish. | KG tests. | PASS | Critical |
| PRICE-07 | KG rejects duplicates, invalid roles/swaps, missing price, inactive category/item and wrong weight increments. | KG tests. | PASS | Critical |
| PRICE-08 | KG rounds each line, uses latest rate, accepts exact boundary weights and does not multiply by guests. | KG tests. | PASS | Critical |
| PRICE-09 | Persisted-money overflow is rejected. | KG overflow test. | PASS | Critical |
| PRICE-10 | Guest count just below/above package bounds is rejected. | Pricing/cart guards; exact endpoint boundary cases are grouped rather than parameterized. | PASS | High |
| PRICE-11 | Historical order price/menu remains immutable after catalogue price/menu changes. | Snapshot tests and order read test. | PASS | Critical |

### Payment, retry and refund safety

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| PAY-01 | Gateway order below ₹1 is rejected; partial amount cannot exceed remaining balance. | Payment tests. | PASS | Critical |
| PAY-02 | Customer may create a partial balance payment only after kitchen approval. | Payment test/service guard. | PASS | Critical |
| PAY-03 | Pending gateway order is reused only after provider validation; obsolete credentials retire it. | Payment tests. | PASS | Critical |
| PAY-04 | Invalid verification or webhook signature is rejected. | Service and DTO inspection; provider-signature path covered in tests. | PASS | Critical |
| PAY-05 | Only one concurrent handler confirms a payment. | Concurrency test. | PASS | Critical |
| PAY-06 | Duplicate unprocessed webhook retries; stale failure cannot overwrite paid state. | Webhook tests. | PASS | Critical |
| PAY-07 | Underpaid capture cannot confirm the booking and late capture cannot resurrect cancellation. | Payment tests. | PASS | Critical |
| PAY-08 | Failed balance payment resynchronizes all child allocations/statuses. | Payment test. | PASS | Critical |
| PAY-09 | Captured unresolved attempt blocks PAY_LATER to prevent duplicate bookings. | Checkout attempt test. | PASS | Critical |
| PAY-10 | Full refund is idempotent; concurrent requests submit once; uncertain response reconciles before retry. | Refund tests. | PASS | Critical |
| PAY-11 | Decline refunds every captured online partial payment and manual refunds record once. | Admin/payment tests. | PASS | Critical |
| PAY-12 | Refund before decline is rejected; refunding one duplicate charge does not erase another captured charge. | Payment tests. | PASS | Critical |
| PAY-13 | Production fails closed when Razorpay is not configured. | Payment test. | PASS | Critical |
| PAY-14A | Razorpay test-mode order creation, invalid verification signature, signed failure webhook and duplicate delivery. | Isolated live HTTP run created provider order `order_TkjHp2Wr8Twyoa`; 400 signature rejection, first webhook receipt, duplicate receipt and persisted `FAILED` attempt all verified. | PASS | Critical |
| PAY-14B | Real Razorpay Checkout capture, provider-originated webhook delivery, key rotation and refund settlement. | Test credentials are configured, but no interactive capture/refund transaction or public webhook endpoint was used. | BLOCKED | Critical |

### Booking, fulfilment, documents and reports

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| BOOK-01 | Successful checkout creates one booking and one child order per package atomically. | Checkout/payment tests and schema review. | PASS | Critical |
| BOOK-02 | Pay-later booking is unpaid and awaiting approval; HALF is partially paid and carts remain until verification. | Checkout attempt tests. | PASS | Critical |
| BOOK-03 | Approval/decline only applies while awaiting approval and updates children transactionally. | Admin state tests/service guards. | PASS | Critical |
| BOOK-04 | Customer/admin cancellation rejects terminal/fulfilment-in-progress states and uses compare-and-update safety. | Service review; older audit evidence; no current dedicated concurrency test. | REVIEWED | Critical |
| BOOK-05 | Fulfilment may advance directly but never backward; every package synchronizes with the aggregate. | Admin order-state tests. | PASS | Critical |
| BOOK-06 | Customer and admin order detail use the same complete immutable menu snapshot. | Order detail tests. | PASS | High |
| BOOK-07 | Child paid/balance amounts reconcile from allocations across multiple deposits. | Ledger test. | PASS | Critical |
| BOOK-08 | Documents aggregate every package and create one receipt per payment. | Document test. | PASS | High |
| BOOK-09 | Document/notes access is scoped to customer ownership or assigned Operations region. | Region-scope tests. | PASS | Critical |
| BOOK-10 | Revenue keeps captures gross and subtracts successful refunds. | Revenue test. | PASS | High |
| BOOK-11 | Customer-visible PDF download content/layout for receipt, invoice and credit note. | Generation logic tested; files not downloaded/rendered in a browser here. | BLOCKED | Medium |

### Admin and operations screens

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| ADMIN-01 | Admin booking pagination transforms safe values and rejects malformed UUID/date/range/limit. | Query tests. | PASS | High |
| ADMIN-02 | Role guard permits only explicit roles; Operations is restricted by assigned region. | Permission/region tests. | PASS | Critical |
| ADMIN-03 | Manual payment enforces positive two-decimal amount, supported method and remaining balance. | DTO/service review; ledger tests. | PASS | Critical |
| ADMIN-04 | Settings reject duplicate keys, non-editable keys, malformed integers/times/percentages and reversed service hours. | Settings tests. | PASS | High |
| ADMIN-05 | Public settings fall back safely if stored numeric values are malformed. | Settings test. | PASS | High |
| ADMIN-06 | Admin login form renders at desktop and 390×844 mobile viewport. | Live browser smoke. | PASS | Medium |
| ADMIN-07 | Authenticated approve, decline, refund, manual payment, note, fulfilment and document actions give correct UI feedback. | Pages and APIs reviewed; no authenticated browser execution. | BLOCKED | Critical |
| ADMIN-08 | Menu/package/import/settings screens preserve unsaved input and recover cleanly from API errors. | Source reviewed; no browser fault-injection suite. | NOT COVERED | Medium |

### Database, migrations and contracts

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| DATA-01 | Event/cart/order collapse copies required data before dropping legacy paths. | Migration safety test. | PASS | Critical |
| DATA-02 | Booking ownership is required for payments/orders and allocations do not duplicate booking ownership. | Migration safety tests. | PASS | Critical |
| DATA-03 | Orders keep cart provenance without owning/deleting checkout carts. | Migration safety test. | PASS | High |
| DATA-04 | Kitchen lead time backfills regions before removing global setting. | Migration test. | PASS | High |
| DATA-05 | Khammam seed migration is idempotent. | Region migration test. | PASS | Medium |
| DATA-06 | API/OpenAPI/frontend contract inventory is synchronized. | `contracts:check` and `test:contracts`. | PASS | High |
| DATA-07 | Live DB business rules pass for meal box, fixed and custom pricing. | `test:business`. | PASS | Critical |
| DATA-08 | Guarded KG database flow completes admin configuration, mixed checkout, pay-later persistence, immutable snapshots and constraints. | Test migrated to the current child-cart snapshot contract and real booking path; full guarded suite passed 129/129. | PASS | High (test gate) |
| DATA-09 | Current database has no orphan/mismatched booking/payment/allocation records. | Seven read-only invariant queries found zero violations for missing orders, aggregate totals, shared fields, cross-booking allocations, paid allocation sums, nonpositive allocations and duplicate active sessions. | PASS | Critical |

### Customer browser and responsive behavior

| ID | Scenario and expected result | Evidence | Status | Release impact |
| --- | --- | --- | --- | --- |
| UI-01 | Home loads database-driven ordering choices, featured packages and kitchens. | Live browser desktop smoke. | PASS | High |
| UI-02 | Package catalogue loads data and package-detail query opens an accessible modal. | Live browser desktop smoke. | PASS | High |
| UI-03 | Package catalogue and primary mobile navigation render at 390×844. | Live browser mobile smoke. | PASS | High |
| UI-04 | Login restricts mobile to 10 digits and OTP to 6 digits; safe return path is used. | Source and client tests; no OTP submission. | REVIEWED | High |
| UI-05 | Guest/auth draft merge decision preserves the chosen cart. | State/store source reviewed; no automated browser case. | NOT COVERED | High |
| UI-06 | Authenticated address/map selection, cart autosave, menu customization and final quote complete in browser. | The isolated identity completed auth/address/cart/quote through HTTP, but the browser interaction and map UI were not executed. | BLOCKED | Critical |
| UI-07 | FULL/HALF/PAY_LATER browser flows route to one booking and recover from payment-window failure. | Isolated Razorpay test order/failure handling passed through HTTP; interactive Checkout capture and the three browser payment-plan paths were not executed. | BLOCKED | Critical |
| UI-08 | Booking list/detail, balance payment, cancellation and document download work on desktop/mobile with keyboard/screen reader. | No authenticated accessibility flow. | BLOCKED | High |

## Executed command results

| Command/check | Result |
| --- | --- |
| `KG_DATABASE_TEST=1 npm run test:api` | **PASS:** 129 passed, 0 failed, 0 skipped |
| `npm run test:client` | **PASS:** 9 passed |
| `npm run test:business` | **PASS:** meal-box, fixed-package and custom-package rules |
| `npm run test:contracts` | **PASS:** 6 core owners, 101 frontend files checked |
| `npm run contracts:check` | **PASS** |
| API/customer/admin lint | **PASS** |
| API/customer/admin production builds | **PASS:** customer 22 routes, admin 15 routes |
| Live API smoke | **PASS:** health/catalog 200; anonymous customer/admin endpoints 401; malformed coordinates 400 |
| Isolated Razorpay test-mode flow | **PASS:** OTP auth, address/cart/quote, provider order creation, invalid signature rejection, signed failure webhook, duplicate webhook idempotency and cleanup |
| Read-only database invariants | **PASS:** 7 checks, 0 violations |
| Live browser smoke | **PASS:** public home, package catalogue/detail, customer mobile catalogue, admin mobile login |
| Skill validator | **BLOCKED:** bundled validator could not import PyYAML; YAML/frontmatter was parsed successfully with Ruby and manually checked |

## Failure analysis

There are **no currently failing business-flow cases** in the executed regression set.

### REG-001 — Guarded KG regression drift

**Status:** Fixed and verified

The test referenced the removed aggregate `prepared.contactNumber`, the old `subtotalAmount` name, and an undefined `kgOrder`. It now asserts contact synchronization on every child snapshot, creates a pay-later booking through the production service, verifies the persisted booking/order and historical menu/price snapshot, and executes the intended database constraints. The guarded suite passes 129/129.

### REG-002 — Error requests logged as success

**Status:** Fixed and verified

The live invalid Razorpay signature returned HTTP 400 but the interceptor logged the route's default 201 because `finalize` observed the response before Nest's exception filter assigned the error status. The logger now records `HttpException` status codes directly and maps unexpected errors to 500. Dedicated 202, 400 and 500 regression cases pass.

## Coverage gaps and corner cases to add next

1. Auth refresh-token replay, rotation and logout invalidation across devices.
2. HTTP-level ownership tests for every customer resource and region-role matrix tests for every admin mutation.
3. Mismatched multi-cart booking fields and cart mutation between quote/payment under real concurrent requests.
4. Exact DTO boundary tables for all money, array, length, date/time and upload limits.
5. Browser automation for guest draft → OTP → address → each package type → multi-cart quote → all payment plans → booking.
6. Browser automation for admin approve/decline, partial/manual payment, refund, fulfilment, notes, reports and documents.
7. Staging provider run covering MSG91, Razorpay capture/webhook/refund, Maps, cloud storage, notifications and PDF download.
8. Extend the now-green read-only invariant audit with terminal-state/history consistency and refund-total checks.

## Release gate

The current decision remains **CONDITIONAL GO**. The automated, database, contract, lint, build, and Razorpay order/failure-webhook gates are green. Promote to **GO** after one isolated browser journey completes a Razorpay test capture, provider-originated webhook, admin approval/fulfilment, customer balance/refund behavior, and cleanup.

Use **NO-GO** if that journey exposes a booking/order mismatch, allocation/aggregate invariant failure, incorrect authorization, or a provider callback that duplicates or resurrects a booking/payment.

## Minimal rerun checklist

```bash
KG_DATABASE_TEST=1 npm run test:api
npm run test:client
npm run test:business
npm run test:contracts
npm run contracts:check
npm run lint
npm run build
```

Then run the isolated customer/admin/provider journey and attach its booking number, payment IDs, webhook event IDs, refund ID, and cleanup result to the release record without including secrets.
