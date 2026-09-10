'use client';

import { ArrowRight, ClipboardList } from 'lucide-react';
import type { OrderSummary } from '@aranyam/shared-types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { useSessionStore } from '../../store/session.store';
import { formatCurrency, formatStatus } from '../../lib/format';

export default function OrdersPage() {
  const session = useSessionStore((s) => s.session);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    apiRequest<OrderSummary[]>('/orders', {}, session.accessToken)
      .then(setOrders)
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, [session]);
  if (!session)
    return (
      <AuthRequiredPanel
        title="Sign in to view your orders"
        description="View order history, receipts, and live status."
        returnHref="/orders"
      />
    );
  return (
    <main className="min-h-screen bg-background pb-28">
      <section className="relative overflow-hidden bg-hero-end text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,hsl(var(--accent)/0.18),transparent_30%),linear-gradient(105deg,hsl(var(--hero-end)),hsl(var(--primary)))]" />
        <div className="container-pad relative py-5 sm:py-12">
          <p className="eyebrow">Your catering history</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold sm:mt-2 sm:text-5xl">
            Your orders
          </h1>
          <p className="mt-3 hidden max-w-xl text-sm leading-6 text-white/75 sm:block sm:text-base">
            Review complete menus, event details, payment status, receipts, and
            delivery progress.
          </p>
        </div>
      </section>
      <div className="container-pad py-4 sm:py-9">
        {loading ? (
          <StatePanel
            tone="loading"
            headingLevel={2}
            title="Loading your orders"
          />
        ) : error ? (
          <StatePanel
            tone="danger"
            headingLevel={2}
            title="Orders could not load"
            description={error}
            actionHref="/orders"
            actionLabel="Try again"
          />
        ) : orders.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="hidden grid-cols-[1.15fr_1.35fr_.85fr_.55fr_.85fr_.8fr_.75fr_24px] gap-4 border-b border-border bg-ivory px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Order</span>
              <span>Package</span>
              <span>Event</span>
              <span>Count</span>
              <span>Status</span>
              <span>Payment</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            <div className="divide-y divide-border">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="group block p-4 transition hover:bg-ivory/70 sm:p-5 md:grid md:grid-cols-[1.15fr_1.35fr_.85fr_.55fr_.85fr_.8fr_.75fr_24px] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white">
                      <ClipboardList className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <strong className="numeric-text block truncate text-base">
                        {order.orderNumber}
                      </strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 min-w-0 md:mt-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">
                      Package
                    </p>
                    <h2 className="mt-1 truncate font-serif text-lg font-semibold md:mt-0">
                      {order.packageName}
                    </h2>
                  </div>
                  <TableValue
                    label="Event"
                    value={
                      order.event?.eventDate
                        ? new Date(order.event.eventDate).toLocaleDateString(
                            'en-IN',
                            { day: 'numeric', month: 'short' },
                          )
                        : 'Not set'
                    }
                  />
                  <TableValue
                    label="Count"
                    value={String(order.guestCount)}
                    numeric
                  />
                  <div className="mt-3 md:mt-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">
                      Status
                    </p>
                    <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary md:mt-0">
                      {formatStatus(order.orderStatus)}
                    </span>
                  </div>
                  <TableValue
                    label="Payment"
                    value={formatStatus(order.paymentStatus)}
                  />
                  <div className="mt-3 md:mt-0 md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">
                      Total
                    </p>
                    <strong className="numeric-text mt-1 block text-lg text-primary md:mt-0 md:text-base">
                      {formatCurrency(order.totalAmount)}
                    </strong>
                  </div>
                  <ArrowRight className="mt-4 h-5 w-5 text-primary transition group-hover:translate-x-1 md:mt-0" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <StatePanel
            headingLevel={2}
            icon={ClipboardList}
            eyebrow="No orders yet"
            title="Your first catering order will appear here"
            description="Choose a package, add your event details, and complete checkout to start tracking."
            actionHref="/packages"
            actionLabel="Browse packages"
            secondaryHref="/menu"
            secondaryLabel="Preview menu"
          />
        )}
      </div>
    </main>
  );
}

function TableValue({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="mt-3 min-w-0 md:mt-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:hidden">
        {label}
      </p>
      <p
        className={`${numeric ? 'numeric-text' : ''} mt-1 truncate text-sm font-semibold md:mt-0`}
      >
        {value}
      </p>
    </div>
  );
}
