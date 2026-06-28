'use client';
import type { OrderDetails, OrderDocument } from '@aranyam/shared-types';
import { Download } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { apiRequest, downloadAuthenticated } from '../../../lib/api';
import { useSessionStore } from '../../../store/session.store';
import { RetryPaymentButton } from '../../../components/retry-payment-button';

export default function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const session = useSessionStore((state) => state.session);
  const [order, setOrder] = useState<OrderDetails>();
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiRequest<OrderDetails>(`/orders/${orderId}`, {}, session.accessToken),
      apiRequest<OrderDocument[]>(
        `/orders/${orderId}/documents`,
        {},
        session.accessToken,
      ),
    ]).then(([nextOrder, nextDocuments]) => {
      setOrder(nextOrder);
      setDocuments(nextDocuments);
    });
  }, [orderId, session]);
  if (!order)
    return (
      <main className="mx-auto max-w-4xl px-5 py-12">Loading order...</main>
    );
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 pb-24">
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
          {order.orderStatus.replaceAll('_', ' ')} · {order.paymentStatus}
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.55fr]">
        <section className="rounded-2xl border bg-white p-5">
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
                <span>₹{item.adjustmentAmount}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t pt-4 text-sm">
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
        <aside className="space-y-6">
          {order.paymentStatus === 'PENDING' && <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">Payment pending</h2><p className="my-3 text-sm text-muted-foreground">Your order is saved. Retrying reuses the same payment order and will not duplicate this booking.</p><RetryPaymentButton order={order} /></section>}
          {order.event && <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">Event and venue</h2><p className="mt-3 text-sm">{order.event.eventName || order.packageName}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(order.event.eventDate).toLocaleDateString('en-IN')} · {order.event.eventTimeStart || 'Time unavailable'}</p>{order.event.address && <p className="mt-2 text-sm text-muted-foreground">{order.event.address.addressLine1}, {order.event.address.city}, {order.event.address.state} {order.event.address.pincode}</p>}</section>}
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-semibold">Progress</h2>
            <div className="mt-4 space-y-4">
              {order.statusHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-primary/30 pl-4"
                >
                  <p className="font-semibold">
                    {entry.toStatus.replaceAll('_', ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.changedAt).toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-5">
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
                  {document.documentType.replaceAll('_', ' ')}
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
