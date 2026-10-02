# Multi-package checkout: order grouping

Status: Deferred  
Documented: 3 October 2026

## Summary

When a customer checks out multiple packages together, the application currently creates one database order for each package even though the customer completes only one checkout and one payment.

This is existing system behaviour rather than a duplicate-payment or retry defect. The package orders are linked by `checkoutBatchId`, and payment is collected once for the combined checkout total.

## Current behaviour

1. The customer-facing cart combines all active package carts into one summary.
2. The final amount includes all package subtotals plus the shared delivery and cutlery charges.
3. One Razorpay order and one gateway charge are created for the combined payable amount.
4. After payment succeeds, checkout loops through the package carts and creates one order for each package.
5. Every generated order receives the same `checkoutBatchId`.
6. The captured payment is allocated across the generated orders. The sum of those allocations equals the single gateway charge.
7. Pay-later checkout follows the same one-order-per-package structure, without a gateway charge.

Example:

- Customer checks out three packages.
- Customer completes one payment.
- Database contains three orders linked by one `checkoutBatchId`.
- Customer and admin screens currently show three separate orders.

## Why it is confusing

The current database structure supports package-level kitchen fulfilment, but the user experience makes one checkout look like multiple independent purchases. It can result in:

- multiple customer order cards and order numbers;
- separate approval actions for packages purchased together;
- repeated notifications and documents;
- fragmented payment, balance and refund information;
- difficulty understanding whether one or several payments were made;
- inconsistent handling when package fulfilment statuses differ.

If the number of created orders exactly matches the number of packages, the current system is working as designed. More orders than packages, repeated orders for the same source cart, or more than one gateway charge would be defects.

## Recommended product behaviour

Present one customer-facing **booking** for each checkout while retaining individual package orders internally for kitchen fulfilment.

- One checkout should have one booking number.
- Payment, approval, decline, refund, address, date and time should appear at booking level.
- Packages should appear as child orders within the booking.
- Kitchen staff should still be able to progress each package independently after approval.
- Existing single-package orders should behave as single-order bookings.

Packages may be grouped only when they share the same delivery address, date, time, region and delivery method. If these fields differ, the customer must check them out as separate bookings.

## Customer panel changes

### Orders list

- Group orders by `checkoutBatchId`.
- Show one booking card per checkout.
- Display the booking number, package count, package names or images, delivery schedule, combined total, amount paid, balance and booking status.

### Booking detail

- Show one common delivery, approval and payment summary.
- List the packages in expandable package cards.
- Show one combined price breakdown.
- Show one decline reason and one consolidated refund state.
- Route checkout and payment confirmation to the booking instead of only the first order.
- Leave space for a future **Pay remaining balance** action.

## Admin panel changes

### Orders list

- Group rows by `checkoutBatchId`.
- Show one booking row with customer/event details, package count, combined total, amount received, balance and approval status.
- Show package progress such as `2 of 3 packages ready`.
- Allow the row to expand to reveal the internal package orders.

### Booking detail

- Show the shared booking information once.
- Show each package as a separate kitchen card.
- Approve or decline the entire booking atomically.
- Keep fulfilment status changes at package level after approval.
- Record offline payments at booking level and distribute them across outstanding package balances.
- Refund all applicable online payment allocations when the booking is declined.

## Backend work

- Add booking-summary responses grouped by `checkoutBatchId`.
- Treat an order without `checkoutBatchId` as a single-order booking.
- Add atomic booking actions for approval, decline, manual payment and refund.
- Add a shared identifier for payment allocations created by one manual deposit.
- Calculate booking totals, received amount, balance and refund amount from all child orders.
- Ensure payment callbacks remain idempotent and cannot recreate package orders.
- Consolidate customer notifications and booking-level documents while retaining package-level kitchen tickets where required.

## Status rules

- `AWAITING_APPROVAL`: all package orders are awaiting approval.
- `CONFIRMED`: the booking has been approved; package fulfilment can start.
- In progress: at least one package is being prepared and not all are ready.
- Ready: all package orders are ready for delivery.
- Delivered: all package orders are delivered.
- Declined or cancelled: applies to the entire booking unless a future partial-cancellation feature is explicitly introduced.
- Mixed or inconsistent approval states should be prevented by transactional booking actions.

## Acceptance criteria

- One combined checkout produces one visible booking in customer and admin lists.
- The customer is charged only once.
- The booking total equals the sum of package subtotals plus shared charges.
- Full and 50% payments reconcile exactly with the combined total.
- Approving or declining updates every package order in one transaction.
- Declining a paid booking refunds all applicable online payment allocations.
- One admin-entered deposit updates the combined booking balance without exceeding it.
- Individual packages can progress independently after booking approval.
- Existing single orders and historical multi-order batches continue to display correctly.
- Duplicate callbacks do not create additional orders or payments.

## Out of scope for the deferred change

- Partial approval of selected packages.
- Different delivery addresses or schedules inside one booking.
- Customer-initiated partial payments from the order page.
- Splitting or transferring packages between bookings after checkout.
