'use client';
import {
  formatTimeOfDay,
  type OrderDocument,
  type OrderDetails,
  type OrderNote,
  type OrderStatus,
} from '@aranyam/shared-types';
import {
  CalendarDays,
  Clock3,
  CreditCard,
  MapPin,
  MessageSquareText,
  Printer,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatusBadge } from '../../../../components/status-badge';
import { Button } from '../../../../components/ui/button';
import { apiRequest, downloadAuthenticated } from '../../../../lib/api';
import { useAdminSessionStore } from '../../../../store/session.store';

const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [],
  PENDING_PAYMENT: [],
  AWAITING_APPROVAL: [],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['READY_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  DECLINED: [],
  CANCELLED: [],
};

export default function AdminOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const session = useAdminSessionStore((state) => state.session);
  const [order, setOrder] = useState<OrderDetails>();
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [status, setStatus] = useState<OrderStatus>('IN_PROGRESS');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const load = async () => {
    if (!session) return;
    const [nextOrder, nextNotes, nextDocuments] = await Promise.all([
      apiRequest<OrderDetails>(
        `/admin/orders/${orderId}`,
        {},
        session.accessToken,
      ),
      apiRequest<OrderNote[]>(
        `/admin/orders/${orderId}/notes`,
        {},
        session.accessToken,
      ),
      apiRequest<OrderDocument[]>(
        `/admin/orders/${orderId}/documents`,
        {},
        session.accessToken,
      ),
    ]);
    setOrder(nextOrder);
    const nextStatuses = validTransitions[nextOrder.orderStatus];
    if (nextStatuses.length) setStatus(nextStatuses[0]);
    setNotes(nextNotes);
    setDocuments(nextDocuments);
  };
  useEffect(() => {
    load();
  }, [session, orderId]);
  async function update() {
    if (
      status === 'CANCELLED' &&
      !window.confirm(
        'Cancel this order? The customer order will stop progressing and this cannot be undone from the admin portal.',
      )
    )
      return;
    setMessage('');
    try {
      await apiRequest(
        `/admin/orders/${orderId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, notes: 'Updated from admin portal' }),
        },
        session!.accessToken,
      );
      setMessage('Order status updated.');
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    await apiRequest(
      `/admin/orders/${orderId}/notes`,
      { method: 'POST', body: JSON.stringify({ body: note }) },
      session!.accessToken,
    );
    setNote('');
    await load();
  }
  async function approveBooking() {
    setMessage('');
    try {
      await apiRequest(
        `/admin/orders/${orderId}/approve`,
        { method: 'POST' },
        session!.accessToken,
      );
      setMessage('Booking approved.');
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function declineBooking(event: React.FormEvent) {
    event.preventDefault();
    if (declineReason.trim().length < 3) return;
    setMessage('');
    try {
      await apiRequest(
        `/admin/orders/${orderId}/decline`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: declineReason.trim() }),
        },
        session!.accessToken,
      );
      setDeclineOpen(false);
      setDeclineReason('');
      setMessage('Booking declined. Any online payment refund was initiated.');
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function recordPayment(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await apiRequest(
        `/admin/orders/${orderId}/payments/manual`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(paymentAmount),
            method: paymentMethod,
            reference: paymentReference || undefined,
            note: paymentNote || undefined,
          }),
        },
        session!.accessToken,
      );
      setPaymentOpen(false);
      setPaymentReference('');
      setPaymentNote('');
      setMessage('Payment recorded.');
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  if (!order) return <main className="admin-page">Loading order...</main>;
  const address = order.event?.address;
  const eventDate = order.event?.eventDate
    ? new Date(order.event.eventDate).toLocaleDateString('en-IN')
    : 'Not scheduled';
  const eventTime = formatTimeOfDay(
    order.event?.eventTimeStart,
    'Not scheduled',
  );
  const venue = [
    address?.addressLine1,
    address?.city,
    address?.state,
    address?.pincode,
  ]
    .filter(Boolean)
    .join(', ');
  const nextStatuses = validTransitions[order.orderStatus];
  return (
    <main className="admin-page">
      <section className="print-ticket" aria-label="Kitchen print ticket">
        <header className="print-ticket-header">
          <strong>The Feast Factory</strong>
          <span>KITCHEN ORDER</span>
        </header>
        <div className="print-ticket-rule" />
        <div className="print-ticket-row print-ticket-order">
          <strong>{order.orderNumber}</strong>
          <strong>{order.orderStatus}</strong>
        </div>
        <div className="print-ticket-row">
          <span>Date</span>
          <strong>{eventDate}</strong>
        </div>
        <div className="print-ticket-row">
          <span>Time</span>
          <strong>{eventTime}</strong>
        </div>
        <div className="print-ticket-row">
          <span>
            {order.packageType === 'ORDER_BY_KG' ? 'Ordering' : 'Guests'}
          </span>
          <strong>
            {order.packageType === 'ORDER_BY_KG' ? 'By KG' : order.guestCount}
          </strong>
        </div>
        <div className="print-ticket-rule" />
        <p className="print-ticket-label">CUSTOMER</p>
        <p>{order.user.name || 'Customer'}</p>
        <p>{order.contactNumber}</p>
        {order.event?.eventName && <p>{order.event.eventName}</p>}
        {venue && <p>{venue}</p>}
        <div className="print-ticket-rule" />
        <p className="print-ticket-label">ITEMS</p>
        {order.selectedItems.map((item) => (
          <div className="print-ticket-item" key={item.id}>
            <span>
              {item.weightGrams != null
                ? `${item.weightGrams / 1000} kg`
                : `${item.quantity} x`}{' '}
              {item.menuItemName}
            </span>
            <span>{item.isVeg ? 'VEG' : 'NON-VEG'}</span>
          </div>
        ))}
        <div className="print-ticket-rule" />
        <p className="print-ticket-label">KITCHEN INSTRUCTIONS</p>
        <p>{order.specialNotes?.trim() || 'None'}</p>
        {order.region?.name && (
          <p className="print-ticket-footer">Kitchen: {order.region.name}</p>
        )}
      </section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Order detail
          </p>
          <h1 className="admin-title mt-2">{order.orderNumber}</h1>
          <p className="mt-2 text-muted-foreground">
            {order.user.name || order.contactNumber} · {order.packageName} ·{' '}
            {order.packageType === 'ORDER_BY_KG' ? 'By KG' : order.guestCount}
            {order.packageType === 'ORDER_BY_KG' ? '' : ' guests'}
          </p>
          {order.region && (
            <p className="mt-1 text-sm text-muted-foreground">
              {order.region.name} kitchen · {order.distanceKm} km · delivery ₹
              {order.deliveryFee}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            title="Print a kitchen ticket on the configured POS printer"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print kitchen ticket
          </Button>
          <StatusBadge value={order.orderStatus} />
          <StatusBadge value={order.paymentStatus} />
        </div>
      </div>
      {message && (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm" aria-live="polite">
          {message}
        </p>
      )}
      <section
        className="admin-card mt-5 border-primary/20 bg-primary/[0.04]"
        aria-label="Delivery schedule"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          Delivery schedule
        </p>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Delivery date</p>
              <p className="font-semibold">{eventDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Delivery time</p>
              <p className="font-semibold">{eventTime}</p>
            </div>
          </div>
        </div>
      </section>
      {order.orderStatus === 'AWAITING_APPROVAL' && (
        <section className="admin-card mt-5 border-amber-300 bg-amber-50/70">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-900">
                Kitchen approval required
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Review availability before accepting this booking
              </h2>
              <p className="mt-1 text-sm text-amber-900/75">
                {order.paymentPlan.replaceAll('_', ' ')} · received ₹
                {order.amountPaid} · balance ₹{order.balanceDue}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="border-red-300 text-red-700"
                onClick={() => setDeclineOpen(true)}
              >
                Decline
              </Button>
              <Button onClick={approveBooking}>Approve booking</Button>
            </div>
          </div>
        </section>
      )}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-6">
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Fulfilment</h2>
            {nextStatuses.length ? (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="min-w-56 flex-1">
                  <span className="mb-1.5 block text-sm font-semibold">
                    Next order status
                  </span>
                  <select
                    className="h-11 w-full rounded-xl border bg-white px-3"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as OrderStatus)
                    }
                  >
                    {nextStatuses.map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant={status === 'CANCELLED' ? 'danger' : 'default'}
                  onClick={update}
                >
                  {status === 'CANCELLED' ? 'Cancel order' : 'Update status'}
                </Button>
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                This order is{' '}
                {order.orderStatus.toLowerCase().replaceAll('_', ' ')} and has
                no further status actions.
              </p>
            )}
          </section>
          <section className="admin-card border-amber-300 bg-amber-50/70">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">Kitchen instructions</h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Customer request · applies to the entire order
                </p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap rounded-xl border border-amber-200 bg-white p-4 text-sm leading-6 text-foreground">
              {order.specialNotes?.trim() || 'No special request provided.'}
            </p>
          </section>
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Selected menu</h2>
            <div className="mt-4 divide-y">
              {order.selectedItems.map((item) => (
                <div className="flex justify-between py-3" key={item.id}>
                  <div>
                    <p className="font-medium">{item.menuItemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.categoryName} ·{' '}
                      {item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                    </p>
                  </div>
                  <span>
                    {item.weightGrams != null
                      ? `${item.weightGrams / 1000} kg × ₹${item.pricePerKg}/kg = ₹${item.lineTotal}`
                      : `+₹${item.adjustmentAmount}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery fee</span>
                <span>₹{order.deliveryFee ?? '0.00'}</span>
              </div>
              <div className="flex justify-between text-2xl font-semibold">
                <span>Total</span>
                <span>₹{order.totalAmount}</span>
              </div>
            </div>
          </section>
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Status timeline</h2>
            <div className="mt-4 space-y-4">
              {order.statusHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-primary/30 pl-4"
                >
                  <StatusBadge value={entry.toStatus} />
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(entry.changedAt).toLocaleString('en-IN')}{' '}
                    {entry.notes ? `· ${entry.notes}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="admin-card">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">Payment summary</h2>
                <p className="text-xs text-muted-foreground">
                  {order.paymentPlan.replaceAll('_', ' ')} plan
                </p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Order total</dt>
                <dd className="font-semibold">₹{order.totalAmount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Amount received</dt>
                <dd className="font-semibold text-emerald-700">
                  ₹{order.amountPaid}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="font-semibold text-primary">
                  ₹{order.balanceDue}
                </dd>
              </div>
              {Number(order.refundedAmount) > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Refunded</dt>
                  <dd className="font-semibold">₹{order.refundedAmount}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4">
              <StatusBadge value={order.paymentStatus} />
            </div>
            {Number(order.balanceDue) > 0 &&
              order.orderStatus !== 'AWAITING_APPROVAL' &&
              order.orderStatus !== 'PENDING_PAYMENT' &&
              order.orderStatus !== 'DECLINED' &&
              order.orderStatus !== 'CANCELLED' && (
                <Button
                  className="mt-4 w-full"
                  onClick={() => {
                    setPaymentAmount(order.balanceDue);
                    setPaymentOpen(true);
                  }}
                >
                  Record payment
                </Button>
              )}
            {order.payments?.length ? (
              <div className="mt-4 space-y-2 border-t pt-4">
                {order.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl bg-muted/50 p-3 text-xs"
                  >
                    <div className="flex justify-between gap-3">
                      <strong>₹{payment.amount}</strong>
                      <StatusBadge value={payment.paymentStatus} />
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {payment.source === 'MANUAL' ? 'Manual' : 'Razorpay'} ·{' '}
                      {payment.paymentMethod || 'Method unavailable'}
                    </p>
                    {payment.externalReference && (
                      <p className="mt-1 break-all text-muted-foreground">
                        Ref: {payment.externalReference}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Venue</h2>
            <p className="mt-3 text-sm">
              {address?.addressLine1}, {address?.city}, {address?.state}{' '}
              {address?.pincode}
            </p>
            {order.region && (
              <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">
                <strong>{order.region.name}</strong>
                <span className="block text-xs text-muted-foreground">
                  Kitchen assignment
                </span>
              </p>
            )}
            {address?.latitude && (
              <a
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                href={`https://www.google.com/maps?q=${address.latitude},${address.longitude}`}
              >
                <MapPin className="h-4 w-4" />
                Open in Google Maps
              </a>
            )}
          </section>
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Internal notes</h2>
            <form onSubmit={addNote} className="mt-4">
              <textarea
                aria-label="Private operations note"
                className="min-h-24 w-full rounded-xl border p-3 text-sm"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a private operations note"
                maxLength={2000}
              />
              <Button className="mt-2 w-full">Add note</Button>
            </form>
            <div className="mt-4 space-y-3">
              {notes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-muted/60 p-3 text-sm"
                >
                  <p>{item.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.author.name} ·{' '}
                    {new Date(item.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Documents</h2>
            <div className="mt-4 space-y-2">
              {documents.map((document) => (
                <button
                  key={document.id}
                  onClick={() =>
                    downloadAuthenticated(
                      `/admin/orders/${orderId}/documents/${document.id}/download`,
                      session!.accessToken,
                    )
                  }
                  className="w-full rounded-xl border p-3 text-left text-sm font-semibold hover:border-primary"
                >
                  {document.documentType.replaceAll('_', ' ')}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {document.documentNumber}
                  </span>
                </button>
              ))}
              {!documents.length && (
                <p className="text-sm text-muted-foreground">
                  Documents appear after a successful payment.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
      {declineOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decline-booking-title"
        >
          <form
            onSubmit={declineBooking}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="decline-booking-title" className="text-2xl font-semibold">
              Decline booking
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The reason will be shown to the customer.
              {Number(order.amountPaid) > 0 &&
                ` A refund of ₹${order.amountPaid} will be initiated for online payments.`}
            </p>
            <label className="mt-5 block">
              <span className="text-sm font-semibold">Reason</span>
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                placeholder="Explain why the kitchen cannot accept this booking"
                className="mt-1.5 min-h-28 w-full rounded-xl border p-3 text-sm"
              />
            </label>
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDeclineOpen(false)}
              >
                Keep booking
              </Button>
              <Button variant="danger" className="flex-1">
                {Number(order.amountPaid) > 0
                  ? 'Decline and refund'
                  : 'Decline booking'}
              </Button>
            </div>
          </form>
        </div>
      )}
      {paymentOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-payment-title"
        >
          <form
            onSubmit={recordPayment}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="record-payment-title" className="text-2xl font-semibold">
              Record payment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Remaining balance ₹{order.balanceDue}
            </p>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold">Amount received</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  max={order.balanceDue}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border px-3"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Payment method</span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD_POS">Card / POS</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold">
                  Reference number{' '}
                  <span className="font-normal">(optional)</span>
                </span>
                <input
                  maxLength={150}
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border px-3"
                  placeholder="UPI, POS or bank reference"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">
                  Internal note <span className="font-normal">(optional)</span>
                </span>
                <textarea
                  maxLength={500}
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  className="mt-1.5 min-h-20 w-full rounded-xl border p-3 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setPaymentOpen(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1">Record payment</Button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
