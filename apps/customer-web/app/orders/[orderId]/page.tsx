'use client';

import type { OrderDocument } from '@aranyam/shared-types';
import { ArrowLeft, CheckCircle2, Download, MapPin, Package, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { apiRequest, downloadAuthenticated } from '../../../lib/api';
import { useSessionStore } from '../../../store/session.store';
import { cn } from '../../../lib/utils';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PREPARING: 'bg-violet-50 text-violet-700',
  IN_TRANSIT: 'bg-sky-50 text-sky-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

export default function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const session = useSessionStore((state) => state.session);
  const [order, setOrder] = useState<any>();
  const [documents, setDocuments] = useState<OrderDocument[]>([]);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiRequest(`/orders/${orderId}`, {}, session.accessToken),
      apiRequest<OrderDocument[]>(`/orders/${orderId}/documents`, {}, session.accessToken),
    ]).then(([nextOrder, nextDocuments]) => {
      setOrder(nextOrder);
      setDocuments(nextDocuments);
    });
  }, [orderId, session]);

  if (!order)
    return (
      <main className="page-shell">
        <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      </main>
    );

  const statusColor = STATUS_COLORS[order.orderStatus] ?? 'bg-primary/10 text-primary';

  const grouped = (order.selectedItems as any[]).reduce((acc: Record<string, any[]>, item: any) => {
    const category = item.categoryName ?? 'Uncategorized';
    acc[category] = [...(acc[category] ?? []), item];
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <main className="pb-28">
      {/* ── Header ── */}
      <div className="bg-primary">
        <div className="container-pad py-8">
          <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All orders
          </Link>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-accent">Order tracking</p>
              <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-white">{order.orderNumber}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/70">
                <span className="flex items-center gap-1.5">
                  <Package className="h-4 w-4" />{order.packageName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />{order.guestCount} guests
                </span>
                {order.region && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />{order.region.name}
                  </span>
                )}
              </div>
            </div>
            <span className={cn('rounded-full px-4 py-2 text-sm font-extrabold', statusColor)}>
              {order.orderStatus.replaceAll('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="container-pad py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Menu ── */}
          <section className="surface-card overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-6 py-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Selected menu</p>
            </div>
            <div className="divide-y divide-border">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="px-6 py-4">
                  <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{category}</p>
                  <div className="space-y-2.5">
                    {items.map((item: any) => (
                      <div key={item.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <p className="min-w-0 font-semibold leading-5">{item.menuItemName}</p>
                        <span className="shrink-0 text-muted-foreground">
                          {Number(item.adjustmentAmount) > 0 ? `+₹${item.adjustmentAmount}` : 'Included'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-6 py-5 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery fee</span>
                <span>₹{order.deliveryFee ?? '0.00'}</span>
              </div>
              <div className="flex justify-between text-xl font-extrabold text-foreground">
                <span>Total</span>
                <span>₹{order.totalAmount}</span>
              </div>
            </div>
          </section>

          {/* ── Sidebar ── */}
          <aside className="space-y-4">
            {/* Status timeline */}
            <div className="surface-card p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Order progress</p>
              <div className="mt-4 space-y-4">
                {order.statusHistory.map((entry: any, i: number) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      {i < order.statusHistory.length - 1 && (
                        <div className="mt-1 h-full w-0.5 bg-primary/10" />
                      )}
                    </div>
                    <div className="pb-4 pt-0.5">
                      <p className="text-sm font-extrabold">{entry.toStatus.replaceAll('_', ' ')}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.changedAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div className="surface-card p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Receipts & invoices</p>
              <div className="mt-4 space-y-2">
                {documents.map((document) => (
                  <Button
                    key={document.id}
                    variant="outline"
                    className="w-full justify-start rounded-xl"
                    onClick={() => downloadAuthenticated(`/orders/${orderId}/documents/${document.id}/download`, session!.accessToken)}
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
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
