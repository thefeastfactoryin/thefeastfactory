'use client';
import {
  adminTransitionOptions,
  type OrderDocument,
  type OrderDetails,
  type OrderNote,
} from '@aranyam/shared-types';
import { MapPin } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatusBadge } from '../../../../components/status-badge';
import { Button } from '../../../../components/ui/button';
import { apiRequest, downloadAuthenticated } from '../../../../lib/api';
import { useAdminSessionStore } from '../../../../store/session.store';

export default function AdminOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const session = useAdminSessionStore((state) => state.session);
  const [order, setOrder] = useState<OrderDetails>();
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [status, setStatus] = useState('IN_PROGRESS');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    if (!session) return;
    const [nextOrder, nextNotes, nextDocuments] = await Promise.all([
      apiRequest<OrderDetails>(`/admin/orders/${orderId}`, {}, session.accessToken),
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
    setNotes(nextNotes);
    setDocuments(nextDocuments);
  };
  useEffect(() => {
    load();
  }, [session, orderId]);
  async function update() {
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
  if (!order) return <main className="admin-page">Loading order...</main>;
  const address = order.event?.address;
  return (
    <main className="admin-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Order detail
          </p>
          <h1 className="admin-title mt-2">{order.orderNumber}</h1>
          <p className="mt-2 text-muted-foreground">
            {order.user.name || order.user.mobileNumber} · {order.packageName} ·{' '}
            {order.guestCount} guests
          </p>
          {order.region && (
            <p className="mt-1 text-sm text-muted-foreground">
              {order.region.name} kitchen · {order.distanceKm} km · delivery ₹
              {order.deliveryFee}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <StatusBadge value={order.orderStatus} />
          <StatusBadge value={order.paymentStatus} />
        </div>
      </div>
      {message && (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{message}</p>
      )}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-6">
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Fulfilment</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <select
                className="h-10 rounded-lg border bg-white px-3"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {adminTransitionOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <Button onClick={update}>Update status</Button>
            </div>
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
                  <span>+₹{item.adjustmentAmount}</span>
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
    </main>
  );
}
