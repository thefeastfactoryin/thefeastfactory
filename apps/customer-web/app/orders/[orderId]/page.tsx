'use client';
import type { OrderDetails, OrderDocument } from '@aranyam/shared-types';
import { Download } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { apiRequest, downloadAuthenticated } from '../../../lib/api';
import { useSessionStore } from '../../../store/session.store';
import { RetryPaymentButton } from '../../../components/retry-payment-button';
import { AuthRequiredPanel, StatePanel } from '../../../components/ui/state-panel';
import { formatCurrency, formatStatus } from '../../../lib/format';

export default function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const session = useSessionStore((state) => state.session);
  const [order, setOrder] = useState<OrderDetails>();
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiRequest<OrderDetails>(`/orders/${orderId}`, {}, session.accessToken),
      apiRequest<OrderDocument[]>(
        `/orders/${orderId}/documents`,
        {},
        session.accessToken,
      ),
    ])
      .then(([nextOrder, nextDocuments]) => {
        setOrder(nextOrder);
        setDocuments(nextDocuments);
      })
      .catch((reason) => setError((reason as Error).message));
  }, [orderId, session]);
  if (!session)
    return (
      <AuthRequiredPanel
        title="Sign in to view this order"
        description="Order details and documents are available only to the customer who placed the order."
        returnHref={`/orders/${orderId}`}
      />
    );
  if (error)
    return (
      <main className="page-shell">
        <StatePanel
          tone="danger"
          title="Order could not load"
          description={error}
          actionHref="/orders"
          actionLabel="Back to orders"
        />
      </main>
    );
  if (!order)
    return (
      <main className="page-shell">
        <StatePanel tone="loading" title="Loading order" />
      </main>
    );
  return (
    <main className="page-shell max-w-5xl pb-24">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Order tracking
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold">
            {order.orderNumber}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {order.packageName} · {order.guestCount} guests
          </p>
          {order.region && (
            <p className="mt-1 text-sm text-muted-foreground">
              {order.region.name} kitchen · {order.distanceKm} km delivery
            </p>
          )}
        </div>
        <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
          {formatStatus(order.orderStatus)} · {formatStatus(order.paymentStatus)}
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.55fr]">
        <section className="surface-card p-5">
          <h2 className="text-xl font-semibold">Selected menu</h2>
          <div className="mt-3 divide-y">
            {order.selectedItems.map((item) => (
              <div key={item.id} className="flex justify-between py-4">
                <div>
                  <p className="font-medium">{item.menuItemName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.categoryName}
                  </p>
                </div>
                <span>{formatCurrency(item.adjustmentAmount)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery fee</span>
              <span>{formatCurrency(order.deliveryFee)}</span>
            </div>
            <div className="flex justify-between text-2xl font-semibold">
              <span>Total</span>
              <span>{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </section>
        <aside className="space-y-6">
          {order.paymentStatus === 'PENDING' && <section className="surface-card p-5"><h2 className="text-xl font-semibold">Payment pending</h2><p className="my-3 text-sm text-muted-foreground">Your order is saved. Retrying reuses the same payment order and will not duplicate this booking.</p><RetryPaymentButton order={order} /></section>}
          {order.event && <section className="surface-card p-5"><h2 className="text-xl font-semibold">Event and venue</h2><p className="mt-3 text-sm">{order.event.eventName || order.packageName}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(order.event.eventDate).toLocaleDateString('en-IN')} · {order.event.eventTimeStart || 'Time unavailable'}</p>{order.event.address && <p className="mt-2 text-sm text-muted-foreground">{order.event.address.addressLine1}, {order.event.address.city}, {order.event.address.state} {order.event.address.pincode}</p>}</section>}
          <section className="surface-card p-5">
            <h2 className="text-xl font-semibold">Progress</h2>
            <div className="mt-4 space-y-4">
              {order.statusHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-primary/30 pl-4"
                >
                  <p className="font-semibold">
                    {formatStatus(entry.toStatus)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.changedAt).toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className="surface-card p-5">
            <h2 className="text-xl font-semibold">Receipts and invoices</h2>
            <div className="mt-4 space-y-2">
              {documents.map((document) => (
                <Button
                  key={document.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() =>
                    downloadAuthenticated(
                      `/orders/${orderId}/documents/${document.id}/download`,
                      session!.accessToken,
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
          </section>
        </aside>
      </div>
    </main>
  );
}
