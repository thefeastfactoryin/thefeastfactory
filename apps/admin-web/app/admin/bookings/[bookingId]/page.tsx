'use client';

import type { BookingDetails } from '@aranyam/shared-types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '../../../../components/admin-page-header';
import { StatusBadge } from '../../../../components/status-badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { apiRequest } from '../../../../lib/api';
import { useAdminSessionStore } from '../../../../store/session.store';

export default function AdminBookingDetailsPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const session = useAdminSessionStore((state) => state.session);
  const [booking, setBooking] = useState<BookingDetails>();
  const [declineReason, setDeclineReason] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session || !bookingId) return;
    setError('');
    try {
      setBooking(
        await apiRequest<BookingDetails>(
          `/admin/bookings/${bookingId}`,
          {},
          session.accessToken,
        ),
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }, [bookingId, session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(path: string, body?: object) {
    if (!session) return;
    setBusy(path);
    setError('');
    try {
      await apiRequest(
        `/admin/bookings/${bookingId}/${path}`,
        { method: 'POST', body: body ? JSON.stringify(body) : undefined },
        session.accessToken,
      );
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy('');
    }
  }

  if (!session) return <main className="admin-page">Sign in to continue.</main>;
  if (!booking)
    return <main className="admin-page">{error || 'Loading booking…'}</main>;

  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="Booking"
        title={booking.bookingNumber}
        description={`${booking.orders.length} package${booking.orders.length === 1 ? '' : 's'} · ${booking.user?.name || booking.contactNumber}`}
      />
      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="admin-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Booking status</h2>
              <div className="flex gap-2">
                <StatusBadge value={booking.status} />
                <StatusBadge value={booking.paymentStatus} />
              </div>
            </div>
            {booking.status === 'AWAITING_APPROVAL' && (
              <div className="mt-5 grid gap-4 border-t border-border pt-5 md:grid-cols-2">
                <div>
                  <Button
                    className="w-full"
                    disabled={Boolean(busy)}
                    onClick={() => action('approve')}
                  >
                    {busy === 'approve' ? 'Approving…' : 'Approve booking'}
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confirms every package in this booking.
                  </p>
                </div>
                <div className="space-y-2">
                  <Input
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    placeholder="Reason for declining"
                  />
                  <Button
                    variant="danger"
                    className="w-full"
                    disabled={!declineReason.trim() || Boolean(busy)}
                    onClick={() => action('decline', { reason: declineReason })}
                  >
                    {busy === 'decline' ? 'Declining…' : 'Decline and refund'}
                  </Button>
                </div>
              </div>
            )}
            {booking.declineReason && (
              <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {booking.declineReason}
              </p>
            )}
          </section>

          <section className="admin-card overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">Package orders</h2>
            </div>
            <div className="divide-y divide-border">
              {booking.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="grid gap-2 p-5 hover:bg-muted/30 md:grid-cols-[1fr_.6fr_.6fr_.5fr] md:items-center"
                >
                  <div>
                    <p className="font-semibold">{order.packageName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.orderNumber}
                    </p>
                  </div>
                  <p>
                    {order.guestCount ? `${order.guestCount} guests` : 'By KG'}
                  </p>
                  <StatusBadge value={order.orderStatus} />
                  <p className="text-right font-semibold">
                    ₹{Number(order.totalAmount).toLocaleString('en-IN')}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="admin-card p-5">
            <h2 className="text-lg font-semibold">Delivery</h2>
            <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Event</p>
                <p className="mt-1 font-medium">
                  {new Date(booking.eventDate).toLocaleDateString('en-IN')} ·{' '}
                  {booking.eventTimeStart}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Address</p>
                <p className="mt-1 font-medium">
                  {booking.addressSnapshot.addressLine1},{' '}
                  {booking.addressSnapshot.city},{' '}
                  {booking.addressSnapshot.pincode}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Service</p>
                <p className="mt-1 font-medium">
                  {booking.deliveryServiceType.replaceAll('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Contact</p>
                <p className="mt-1 font-medium">{booking.contactNumber}</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="admin-card p-5">
            <h2 className="text-lg font-semibold">Payment summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Booking total" value={booking.totalAmount} />
              <Row label="Received" value={booking.amountPaid} />
              <Row label="Balance due" value={booking.balanceDue} strong />
            </dl>
            <p className="mt-4 rounded-lg bg-muted p-3 text-sm">
              {booking.paymentPlan.replaceAll('_', ' ')} plan
            </p>
            {Boolean(booking.payments?.length) && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Payment history</h3>
                {booking.payments?.map((payment) => {
                  const refunded = payment.refunds?.some(
                    (refund) => refund.refundStatus === 'SUCCESS',
                  );
                  const canConfirmManualRefund =
                    session.admin.role === 'OPERATIONS' &&
                    booking.status === 'DECLINED' &&
                    payment.source === 'MANUAL' &&
                    payment.paymentStatus === 'PAID' &&
                    !refunded;
                  return (
                    <div
                      key={payment.id}
                      className="rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {payment.source === 'MANUAL'
                              ? payment.paymentMethod?.replaceAll('_', ' ') ||
                                'Manual deposit'
                              : 'Online payment'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.externalReference ||
                              payment.razorpayPaymentId ||
                              payment.paymentStatus.replaceAll('_', ' ')}
                          </p>
                        </div>
                        <strong>
                          ₹{Number(payment.amount).toLocaleString('en-IN')}
                        </strong>
                      </div>
                      {refunded && (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Refunded
                        </p>
                      )}
                      {canConfirmManualRefund && (
                        <Button
                          variant="outline"
                          className="mt-3 w-full"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            action(
                              `payments/${payment.id}/manual-refund`,
                              {
                                reason:
                                  booking.declineReason ||
                                  'Manual refund completed',
                              },
                            )
                          }
                        >
                          {busy ===
                          `payments/${payment.id}/manual-refund`
                            ? 'Recording refund…'
                            : 'Confirm manual refund completed'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {booking.status === 'CONFIRMED' && Number(booking.balanceDue) > 0 && (
            <section className="admin-card p-5">
              <h2 className="text-lg font-semibold">Record manual deposit</h2>
              <div className="mt-4 space-y-3">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={booking.balanceDue}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={`Up to ₹${booking.balanceDue}`}
                />
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
                >
                  {['UPI', 'CASH', 'CARD_POS', 'BANK_TRANSFER', 'OTHER'].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Reference (optional)"
                />
                <Button
                  className="w-full"
                  disabled={!Number(amount) || Boolean(busy)}
                  onClick={() =>
                    action('payments/manual', {
                      amount: Number(amount),
                      method,
                      reference: reference || undefined,
                    })
                  }
                >
                  {busy === 'payments/manual' ? 'Recording…' : 'Record deposit'}
                </Button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? 'border-t border-border pt-3 text-base font-semibold' : ''}`}
    >
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd>₹{Number(value).toLocaleString('en-IN')}</dd>
    </div>
  );
}
