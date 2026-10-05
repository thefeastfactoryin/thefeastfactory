'use client';

import type { BookingDetails, BookingDocument } from '@aranyam/shared-types';
import { CalendarDays, Download, MapPin, Package, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RetryPaymentButton } from '../../../components/retry-payment-button';
import { Button } from '../../../components/ui/button';
import {
  AuthRequiredPanel,
  StatePanel,
} from '../../../components/ui/state-panel';
import { apiRequest, downloadAuthenticated } from '../../../lib/api';
import {
  formatCurrency,
  formatCustomerBookingStatus,
  formatStatus,
} from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { useSessionStore } from '../../../store/session.store';

export default function BookingDetailsPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const session = useSessionStore((state) => state.session);
  const [booking, setBooking] = useState<BookingDetails>();
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || !bookingId) return;
    Promise.all([
      apiRequest<BookingDetails>(
        `/bookings/${bookingId}`,
        {},
        session.accessToken,
      ),
      apiRequest<BookingDocument[]>(
        `/bookings/${bookingId}/documents`,
        {},
        session.accessToken,
      ),
    ])
      .then(([nextBooking, nextDocuments]) => {
        setBooking(nextBooking);
        setDocuments(nextDocuments);
      })
      .catch((reason) => setError((reason as Error).message));
  }, [session, bookingId]);

  if (!session)
    return (
      <AuthRequiredPanel
        title="Sign in to view this booking"
        description="Booking details are linked to the verified customer account."
        returnHref={`/bookings/${bookingId}`}
      />
    );
  if (error)
    return (
      <main className="page-shell">
        <StatePanel
          tone="danger"
          title="Booking could not load"
          description={error}
          actionHref="/bookings"
          actionLabel="View bookings"
        />
      </main>
    );
  if (!booking) return <StatePanel tone="loading" title="Loading booking" />;

  const primaryOrder = booking.orders[0];
  const canPay =
    booking.status === 'CONFIRMED' && Number(booking.balanceDue) > 0;

  return (
    <main className="min-h-screen bg-background pb-28">
      <section className="bg-hero-end text-white">
        <div className="container-pad py-6 sm:py-10">
          <Link
            href="/bookings"
            className="text-sm text-white/75 hover:text-white"
          >
            ← All bookings
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="numeric-text text-sm text-white/70">
                {booking.bookingNumber}
              </p>
              <h1 className="mt-1 font-serif text-3xl font-semibold sm:text-5xl">
                Booking details
              </h1>
            </div>
            <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">
              {formatCustomerBookingStatus(booking.status)}
            </span>
          </div>
        </div>
      </section>

      <div className="container-pad grid gap-5 py-5 lg:grid-cols-[1fr_360px] lg:py-9">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="text-xl font-semibold">When &amp; where</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">
                    {new Date(booking.eventDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.eventTimeStart || 'Time not recorded'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                <p className="text-sm leading-6">
                  {booking.addressSnapshot.addressLine1}
                  {booking.addressSnapshot.addressLine2
                    ? `, ${booking.addressSnapshot.addressLine2}`
                    : ''}
                  , {booking.addressSnapshot.city},{' '}
                  {booking.addressSnapshot.pincode}
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-xl font-semibold">Packages</h2>
            </div>
            <div className="divide-y divide-border">
              {booking.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/bookings/${booking.id}/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 p-5 hover:bg-ivory/70"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-xl bg-primary/10 p-2 text-primary">
                      <Package className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {order.packageName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.packageType === 'ORDER_BY_KG'
                          ? 'Order by KG'
                          : `${order.guestCount ?? 0} guests`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(order.totalAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCustomerBookingStatus(booking.status)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-white p-5 shadow-card lg:sticky lg:top-24">
          <div className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Payment</h2>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <PriceRow label="Packages" value={booking.itemsSubtotal} />
            <PriceRow label="Delivery" value={booking.deliveryFee} />
            <PriceRow label="Cutlery" value={booking.cutleryTotal} />
            <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatCurrency(booking.totalAmount)}</dd>
            </div>
            <PriceRow label="Paid" value={booking.amountPaid} accent />
            <PriceRow label="Balance" value={booking.balanceDue} strong />
          </dl>
          <p className="mt-4 rounded-xl bg-ivory px-3 py-2 text-sm">
            {formatStatus(booking.paymentStatus)} ·{' '}
            {formatStatus(booking.paymentPlan)}
          </p>
          {canPay && primaryOrder && (
            <BookingPaymentControls booking={booking} />
          )}
          {booking.status === 'AWAITING_APPROVAL' && (
            <p className="mt-4 text-sm text-muted-foreground">
              The kitchen will review this booking before any later payment is
              collected.
            </p>
          )}
          {booking.status === 'DECLINED' && booking.declineReason && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {booking.declineReason}
            </p>
          )}
          <div className="mt-5 border-t border-border pt-5">
            <h3 className="font-semibold">Receipts &amp; invoices</h3>
            <div className="mt-3 space-y-2">
              {documents.map((document) => (
                <Button
                  key={document.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() =>
                    downloadAuthenticated(
                      `/bookings/${bookingId}/documents/${document.id}/download`,
                      session.accessToken,
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  {formatStatus(document.documentType)}
                </Button>
              ))}
              {!documents.length && (
                <p className="text-sm text-muted-foreground">
                  Documents become available after payment confirmation.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function BookingPaymentControls({ booking }: { booking: BookingDetails }) {
  const primaryOrder = booking.orders[0];
  const balance = Number(booking.balanceDue);
  const [mode, setMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [partialAmount, setPartialAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  if (!primaryOrder || balance <= 0) return null;

  const amount = mode === 'FULL' ? balance : Number(partialAmount);
  const amountIsValid =
    Number.isFinite(amount) && amount >= 1 && amount <= balance;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-semibold">Choose payment amount</p>
      <div
        className="mt-3 grid grid-cols-2 gap-2"
        role="group"
        aria-label="Payment amount type"
      >
        <button
          type="button"
          aria-pressed={mode === 'FULL'}
          className={cn(
            'min-h-11 rounded-xl border px-3 text-sm font-bold',
            mode === 'FULL'
              ? 'border-primary bg-primary text-white'
              : 'border-border bg-white text-foreground',
          )}
          onClick={() => {
            setMode('FULL');
            setPaymentError('');
          }}
        >
          Pay full
        </button>
        <button
          type="button"
          aria-pressed={mode === 'PARTIAL'}
          className={cn(
            'min-h-11 rounded-xl border px-3 text-sm font-bold',
            mode === 'PARTIAL'
              ? 'border-primary bg-primary text-white'
              : 'border-border bg-white text-foreground',
          )}
          onClick={() => {
            setMode('PARTIAL');
            setPartialAmount('');
            setPaymentError('');
          }}
        >
          Pay some amount
        </button>
      </div>

      {mode === 'PARTIAL' && (
        <label className="mt-3 block">
          <span className="text-sm font-semibold">Amount to pay</span>
          <span className="mt-1.5 flex items-center rounded-xl border border-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <span className="pl-3 font-bold text-muted-foreground">₹</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              max={balance}
              step="0.01"
              value={partialAmount}
              onChange={(event) => {
                setPartialAmount(event.target.value);
                setPaymentError('');
              }}
              className="h-11 min-w-0 flex-1 bg-transparent px-2 outline-none"
              placeholder={`Maximum ${formatCurrency(balance)}`}
            />
          </span>
          {!amountIsValid && partialAmount && (
            <span className="mt-1.5 block text-xs font-semibold text-red-700">
              Enter an amount from ₹1 to {formatCurrency(balance)}.
            </span>
          )}
        </label>
      )}

      {paymentError && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
          {paymentError}
        </p>
      )}
      <RetryPaymentButton
        bookingId={booking.id}
        order={primaryOrder}
        amount={amountIsValid ? amount : undefined}
        disabled={!amountIsValid}
        label={
          amountIsValid
            ? `Pay ${formatCurrency(amount)} securely`
            : 'Enter a valid amount'
        }
        className="mt-4 w-full"
        onStart={() => setPaymentError('')}
        onFailure={setPaymentError}
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Maximum payable now: {formatCurrency(balance)}
      </p>
    </div>
  );
}

function PriceRow({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: string;
  accent?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${accent ? 'text-primary' : ''} ${strong ? 'font-semibold' : ''}`}
    >
      <dt className={accent || strong ? '' : 'text-muted-foreground'}>
        {label}
      </dt>
      <dd>{formatCurrency(value)}</dd>
    </div>
  );
}
