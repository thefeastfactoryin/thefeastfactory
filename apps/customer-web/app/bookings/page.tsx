'use client';

import type { BookingSummary } from '@aranyam/shared-types';
import { ArrowRight, CalendarDays, ClipboardList, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import {
  formatCurrency,
  formatCustomerBookingStatus,
  formatStatus,
} from '../../lib/format';
import { useSessionStore } from '../../store/session.store';

export default function BookingsPage() {
  const session = useSessionStore((state) => state.session);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    apiRequest<BookingSummary[]>('/bookings', {}, session.accessToken)
      .then(setBookings)
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) {
    return (
      <AuthRequiredPanel
        title="Sign in to view your bookings"
        description="View packages, payment status and kitchen progress for every booking."
        returnHref="/bookings"
      />
    );
  }

  return (
    <main className="min-h-screen bg-background pb-28">
      <section className="relative overflow-hidden bg-hero-end text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,hsl(var(--accent)/0.18),transparent_30%),linear-gradient(105deg,hsl(var(--hero-end)),hsl(var(--primary)))]" />
        <div className="container-pad relative py-6 sm:py-12">
          <p className="eyebrow">Your catering history</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold sm:text-5xl">
            Your bookings
          </h1>
          <p className="mt-3 hidden max-w-xl text-white/75 sm:block">
            Each booking keeps all packages, delivery details and payments
            together.
          </p>
        </div>
      </section>
      <div className="container-pad py-5 sm:py-9">
        {loading ? (
          <StatePanel tone="loading" title="Loading your bookings" />
        ) : error ? (
          <StatePanel
            tone="danger"
            title="Bookings could not load"
            description={error}
            actionHref="/bookings"
            actionLabel="Try again"
          />
        ) : !bookings.length ? (
          <StatePanel
            icon={ClipboardList}
            title="No bookings yet"
            description="Your completed checkout will appear here."
            actionHref="/packages"
            actionLabel="Browse packages"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {bookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="group rounded-2xl border border-border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="numeric-text font-semibold text-primary">
                      {booking.bookingNumber}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {booking.orders.length} package
                      {booking.orders.length === 1 ? '' : 's'}
                    </h2>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {formatCustomerBookingStatus(booking.status)}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {new Date(booking.eventDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    {booking.eventTimeStart
                      ? `· ${booking.eventTimeStart}`
                      : ''}
                  </p>
                  <p className="flex items-center gap-2 truncate">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    {booking.addressSnapshot.addressLine1},{' '}
                    {booking.addressSnapshot.city}
                  </p>
                </div>
                <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {formatStatus(booking.paymentStatus)}
                    </p>
                    <strong className="numeric-text text-xl text-primary">
                      {formatCurrency(booking.totalAmount)}
                    </strong>
                  </div>
                  <ArrowRight className="h-5 w-5 text-primary transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
