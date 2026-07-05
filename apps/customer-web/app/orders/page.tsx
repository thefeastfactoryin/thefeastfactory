'use client';

import { ClipboardList } from 'lucide-react';
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
        description="Order history, receipts, and live tracking are available after mobile verification."
        returnHref="/orders"
      />
    );
  return (
    <main className="page-shell pb-28">
      <p className="eyebrow">Your history</p>
      <h1 className="mt-3 font-serif text-5xl font-semibold">Orders</h1>
      {loading ? (
        <StatePanel className="mt-8" tone="loading" headingLevel={2} title="Loading your orders" />
      ) : error ? (
        <StatePanel
          className="mt-8"
          tone="danger"
          headingLevel={2}
          title="Orders could not load"
          description={error}
          actionHref="/orders"
          actionLabel="Try again"
        />
      ) : orders.length ? (
        <div className="mt-8 grid gap-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="surface-card flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-primary/30"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div>
                  <strong>{order.orderNumber}</strong>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.packageName} · {order.guestCount} guests
                  </p>
                  {order.region && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order.region.name} · delivery{' '}
                      {formatCurrency(order.deliveryFee)}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {formatStatus(order.orderStatus)}
                </p>
                <strong className="mt-2 block">{formatCurrency(order.totalAmount)}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <StatePanel
          className="mt-8"
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
    </main>
  );
}
