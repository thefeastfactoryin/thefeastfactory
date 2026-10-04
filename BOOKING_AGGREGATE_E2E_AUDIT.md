# Booking Aggregate End-to-End Audit

Date: 4 October 2026  
Scope: database migration, cart session, booking creation, approval, manual deposits, customer/admin reads, compatibility, security, and responsive-screen availability.

## Outcome

The booking aggregate is implemented end to end. A multi-package cart now becomes one booking with child package orders, one booking-level payment ledger, and explicit per-order payment allocations. Existing orders were backfilled without destructive rewrites.

The live audit found and corrected two issues before completion:

1. Prisma declared a redundant `payment_allocations.bookingId` relation that the migration did not create. This caused the second manual deposit to fail. The duplicate relation was removed because an allocation already belongs to a booking through its payment.
2. Booking/order status history could serialize the complete admin record, including `passwordHash`. History queries now select only the admin ID and display name.

The live audit also corrected child-order paid and balance amounts to use payment allocations instead of the payment row's primary order reference.

## Follow-up Audit

A second payment-focused review found and corrected additional edge cases that were not exercised by the original happy-path run:

1. A failed balance-payment webhook now resynchronizes the booking and every child order from allocation data instead of recalculating only the payment's compatibility `orderId`.
2. Pay later is blocked while an earlier captured payment for the same carts is unresolved, preventing a duplicate unpaid booking beside a captured payment.
3. Offline deposits on declined bookings now have an Operations-only action to confirm the manual refund. The refund is recorded in the same ledger, updates booking and child balances, and generates the normal refund documents.
4. Legacy order cancellation and admin booking cancellation now use compare-and-update guards so a stale request cannot overwrite a concurrent status transition.
5. Normal admin booking results exclude historical `PENDING_PAYMENT` placeholders unless that status is explicitly requested.
6. Customer/order booking responses now expose only contract-approved payment and refund fields; gateway responses, Razorpay signatures, and internal audit fields are no longer serialized.
7. Customer payment controls now exist only on the booking detail page. Individual order pages are read-only for payments, while the booking page supports either the full remaining balance or a customer-entered partial amount capped by that balance.

## Audited Flow

1. **Customer authentication and cart setup — Healthy**
   - Used an isolated local test login.
   - Added a valid geocoded Hyderabad delivery address.
   - Added a fixed package and a meal box to the same cart session.
   - Confirmed shared address, date, time, contact, region, and delivery service.

2. **Multi-package quote — Healthy**
   - Two packages quoted as one checkout.
   - Aggregate total: ₹10,970.00.
   - Delivery and cutlery were charged once at booking level.

3. **Pay-later checkout — Healthy**
   - One booking and two child orders were created atomically.
   - Booking status: `AWAITING_APPROVAL`.
   - Payment status: `UNPAID`.
   - All active carts were consumed after successful booking creation.

4. **Kitchen approval — Healthy**
   - Booking changed to `CONFIRMED`.
   - Both child orders changed to `CONFIRMED` in the same transaction.
   - Booking and child status histories were recorded.

5. **First manual deposit — Healthy**
   - Recorded ₹5,485.00 by UPI.
   - Booking changed to `PARTIALLY_PAID`.
   - The payment was allocated across child orders without replacing earlier ledger rows.

6. **Second manual deposit — Healthy after audit fix**
   - Recorded the ₹5,485.00 balance by cash.
   - Booking changed to `PAID` with a zero balance.
   - Child ledgers resolved to ₹990.00 and ₹9,980.00 paid, both with zero balance.

7. **Customer/admin booking reads — Healthy**
   - Both APIs returned the same aggregate total, paid amount, balance, booking status, and package count.
   - No admin password hash was present in either response.

8. **Temporary-data cleanup — Healthy**
   - Removed only the customer, OTP, address, booking, child orders, allocations, payments, and generated documents created by this audit.
   - Confirmed no temporary audit user remained.

9. **Responsive visual capture — Blocked by browser isolation**
   - The customer and admin applications both compile their booking list/detail routes for desktop and mobile layouts.
   - The Codex in-app browser could reach the existing port 3000 application but could not reach the isolated authenticated audit application on port 3100. Chrome was not available to the computer-use runtime.
   - Therefore no screenshot-based visual or keyboard-accessibility claims are made in this audit. Responsive reflow, focus order, screen-reader announcements, and contrast still require a browser session that can reach the isolated authenticated app.

## Database Integrity Results

| Check | Result |
| --- | ---: |
| Orders without a booking | 0 |
| Booking/order total mismatches | 0 |
| Payment/allocation mismatches | 0 |
| Booking/child shared-field mismatches | 0 |
| Duplicate active cart sessions per user | 0 |
| Payments without a booking | 0 |
| Temporary audit users remaining | 0 |
| Migrated bookings requiring manual review | 1 |

The single `migrationNeedsReview` booking predates this implementation and has conflicting historical order/payment states. It remains visible for explicit admin review rather than being guessed or silently rewritten.

## Remaining Rollout Checks

- One historical booking is intentionally queued for admin review, as shown above.
- Kitchen declines now cover online and manual refund completion. Customer/admin cancellation refunds remain support-assisted because the current cancellation policy makes eligibility depend on timing and preparation state; automatic cancellation refunds need an explicit business rule before implementation.
- Razorpay capture/refund webhooks and provider-side refund settlement still require one staging transaction with production-like credentials. Local mode and automated reconciliation tests passed, but they cannot prove provider configuration or delivery.
- Authenticated mobile/desktop screenshot and keyboard testing remains pending because the isolated audit app was not reachable from the available browser runtime.

## Automated Verification

- API tests: 127 passed, 1 database-only test skipped by its existing environment guard.
- API client tests: 9 passed.
- API, customer, and admin production builds: passed.
- Lint across all three applications: passed.
- OpenAPI generation, contract check, and frontend contract inventory: passed.
- Live database business rules for meal boxes, fixed packages, and custom packages: passed.
- Prisma migration applied and verified against the local development database.

## Compatibility and Rollout

- Existing orders are retained as child orders and linked to backfilled bookings.
- Existing payment rows are retained and receive allocation rows.
- Legacy order detail and payment-batch reads remain available for historical links and older in-flight screens.
- New cart checkout uses only the atomic booking path; unused sequential cart/order creation functions and their obsolete test file were removed.
- Rollout should apply the migration before deploying the API, then deploy customer and admin applications from the same release.
