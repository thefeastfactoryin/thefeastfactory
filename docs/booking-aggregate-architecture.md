# Booking aggregate architecture

This is the single supported checkout and fulfilment model. The production
cutover migrations intentionally remove standalone legacy records instead of
maintaining parallel compatibility paths.

## Ownership

### Cart

- A mutable pre-checkout draft owned by one customer.
- Stores the package selection needed to quote and create a checkout snapshot.
- Multiple carts can be checked out together into one booking.
- Carts are deleted once checkout is finalized. Expired or abandoned carts are
  also deleted after the retention period.
- A cart never owns a booking, order, or payment.

### Booking

- The aggregate root for one customer checkout.
- Owns customer/event/address/delivery details, cutlery, totals, approval,
  cancellation, fulfilment, documents, notes, and payment state.
- Customer and admin lifecycle actions target `bookingId`.
- Customer-facing status is derived from the booking and remains deliberately
  simple: awaiting confirmation, confirmed, declined/cancelled, or completed.

### Order

- A required child of exactly one booking, representing one package in that
  booking.
- Stores an immutable package and menu snapshot for kitchen preparation,
  reporting, and per-package price allocation.
- Has no independent approval, cancellation, fulfilment, or payment workflow.
- Is addressed only below its booking:
  - `GET /bookings/:bookingId/orders/:orderId`
  - `GET /admin/bookings/:bookingId/orders/:orderId`
- `sourceCartId` is audit provenance only. There is no database relation to a
  cart and no runtime order-detail dependency on a cart.

### Payment

- Belongs to exactly one booking.
- Supports gateway and admin-recorded deposits, including partial payments.
- Payment allocations may attribute part of a booking payment to child orders
  for accounting/reporting, but they do not make an order the payment owner.
- The booking ledger is the authoritative paid, refunded, and balance-due view.

## Supported flow

1. Customer builds one or more carts.
2. Checkout creates an immutable snapshot and a checkout attempt.
3. Finalization creates one booking, one child order per package, and any
   booking payment/allocations in a single transaction.
4. Source carts are deleted.
5. Approval, cancellation, fulfilment, invoices/GST documents, notes, and all
   later deposits are managed through the booking.

## Deliberately unsupported legacy paths

- Standalone orders without a booking.
- Payments owned by an order.
- Top-level `/orders/:id` or `/admin/orders/:id` lifecycle APIs/pages.
- Recovering checked-out carts through an order-to-cart relation.
- Order-level approval, cancellation, fulfilment, or payment mutations.
