'use client';

import { ClipboardList } from 'lucide-react';
import type { OrderSummary } from '@aranyam/shared-types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { useSessionStore } from '../../store/session.store';

export default function OrdersPage() {
  const session = useSessionStore((s) => s.session);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  useEffect(() => {
    if (session)
      apiRequest<OrderSummary[]>('/orders', {}, session.accessToken).then(setOrders);
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
      {orders.length ? (
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
                      {order.region.name} · delivery ₹
                      {order.deliveryFee ?? '0.00'}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {order.orderStatus.replaceAll('_', ' ')}
                </p>
                <strong className="mt-2 block">₹{order.totalAmount}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <StatePanel
          className="mt-8"
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
