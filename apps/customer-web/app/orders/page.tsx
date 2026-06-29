'use client';

import { ArrowRight, CalendarDays, ClipboardList, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { useSessionStore } from '../../store/session.store';
import { cn } from '../../lib/utils';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PREPARING: 'bg-violet-50 text-violet-700',
  IN_TRANSIT: 'bg-sky-50 text-sky-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

export default function OrdersPage() {
  const session = useSessionStore((s) => s.session);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (session)
      apiRequest<any[]>('/orders', {}, session.accessToken).then(setOrders);
  }, [session]);

  if (!session)
    return (
      <AuthRequiredPanel
        title="Sign in to view your orders"
        description="Order history, receipts, and live tracking are available after mobile verification."
        returnHref="/orders"
      />
    );

  return (
    <main className="pb-28">
      {/* ── Header ── */}
      <div className="bg-primary">
        <div className="container-pad py-10">
          <p className="eyebrow text-accent">Your history</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Orders</h1>
          <p className="mt-2 text-sm text-white/70">
            Track live orders and access receipts for past catering events.
          </p>
        </div>
      </div>

      <div className="container-pad py-8">
        {orders.length ? (
          <div className="grid gap-4">
            {orders.map((order) => {
              const statusColor = STATUS_COLORS[order.orderStatus] ?? 'bg-primary/10 text-primary';
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="surface-card group flex flex-col gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <ClipboardList className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-extrabold">{order.orderNumber}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {order.packageName} · {order.guestCount} guests
                        </span>
                        {order.region && (
                          <span className="text-xs">
                            {order.region.name} · ₹{order.deliveryFee ?? '0.00'} delivery
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-6">
                    <div className="text-left sm:text-right">
                      <p className="text-xl font-extrabold">₹{order.totalAmount}</p>
                    </div>
                    <span className={cn('rounded-full px-3 py-1 text-xs font-extrabold', statusColor)}>
                      {order.orderStatus.replaceAll('_', ' ')}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <StatePanel
            className="mt-4"
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
