'use client';

import type {
  OrderDetails,
  OrderDocument,
  OrderSelectedItem,
} from '@aranyam/shared-types';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Download,
  MapPin,
  Package,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { RetryPaymentButton } from '../../../components/retry-payment-button';
import { Button } from '../../../components/ui/button';
import {
  AuthRequiredPanel,
  StatePanel,
} from '../../../components/ui/state-panel';
import { apiRequest, downloadAuthenticated } from '../../../lib/api';
import { formatCurrency, formatStatus } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { useSessionStore } from '../../../store/session.store';

const roleCopy = {
  INCLUDED: { label: 'Included', style: 'bg-accent/10 text-gold-text' },
  SWAP: { label: 'Substitution', style: 'bg-emerald-50 text-emerald-700' },
  EXTRA: { label: 'Extra', style: 'bg-primary/[0.07] text-primary' },
  CUSTOM: { label: 'Selected', style: 'bg-muted text-charcoal' },
} as const;

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

  const menuGroups = useMemo(() => {
    if (!order) return [];
    return order.selectedItems.reduce<
      Array<{ name: string; items: OrderSelectedItem[] }>
    >((groups, item) => {
      const group = groups.find((entry) => entry.name === item.categoryName);
      if (group) group.items.push(item);
      else groups.push({ name: item.categoryName, items: [item] });
      return groups;
    }, []);
  }, [order]);

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

  const eventDate = order.event?.eventDate
    ? new Date(order.event.eventDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date unavailable';

  return (
    <main className="min-h-screen bg-background pb-24">
      <section className="relative overflow-hidden bg-hero-end text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_28%,hsl(var(--accent)/0.18),transparent_28%),linear-gradient(100deg,hsl(var(--hero-end)),hsl(var(--primary)))]" />
        <div className="container-pad relative py-7 sm:py-9">
          <Link
            href="/orders"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> All orders
          </Link>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow">Order details</p>
              <h1 className="numeric-text mt-2 text-3xl font-bold sm:text-4xl">
                {order.orderNumber}
              </h1>
              <p className="mt-2 text-sm text-white/75">
                Placed on{' '}
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold">
                {formatStatus(order.orderStatus)}
              </span>
              <span className="rounded-full bg-accent px-3 py-2 text-xs font-bold text-accent-foreground">
                {formatStatus(order.paymentStatus)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="container-pad py-6 sm:py-8">
        <section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={Package} label="Package" value={order.packageName} />
          <Fact
            icon={Users}
            label="Guests / boxes"
            value={String(order.guestCount)}
          />
          <Fact icon={CalendarDays} label="Event date" value={eventDate} />
          <Fact
            icon={Clock3}
            label="Delivery time"
            value={order.event?.eventTimeStart || 'Time unavailable'}
          />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
              <div>
                <p className="eyebrow text-primary">Complete menu</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  All ordered items
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.selectedItems.length} items across {menuGroups.length}{' '}
                  categories
                </p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/[0.08] text-primary">
                <ReceiptText className="h-5 w-5" />
              </span>
            </div>

            <div className="space-y-4 bg-ivory p-4 sm:p-5">
              {menuGroups.map((group) => (
                <section
                  key={group.name}
                  className="overflow-hidden rounded-xl border border-border bg-white"
                >
                  <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-3">
                    <h3 className="font-bold text-charcoal">{group.name}</h3>
                    <span className="numeric-text text-xs text-muted-foreground">
                      {group.items.length} item
                      {group.items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {group.items.map((item) => (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        guestCount={order.guestCount}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <aside className="space-y-5 lg:sticky lg:top-20">
            {order.paymentStatus === 'PENDING' && (
              <section className="rounded-2xl border border-accent/35 bg-accent/[0.08] p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-primary">
                    <RefreshCw className="h-4 w-4" />
                  </span>
                  <h2 className="font-serif text-xl font-semibold">
                    Payment pending
                  </h2>
                </div>
                <p className="my-3 text-sm leading-6 text-muted-foreground">
                  Your booking is saved. Retrying will reuse this order and will
                  not create a duplicate.
                </p>
                <RetryPaymentButton order={order} />
              </section>
            )}

            <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <p className="eyebrow text-primary">Price summary</p>
              <div className="mt-4 space-y-3 text-sm">
                <PriceLine
                  label="Menu subtotal"
                  value={formatCurrency(
                    Number(order.totalAmount) - Number(order.deliveryFee ?? 0),
                  )}
                />
                <PriceLine
                  label="Delivery"
                  value={formatCurrency(order.deliveryFee)}
                />
                <div className="flex items-end justify-between gap-4 border-t pt-4">
                  <span className="font-bold">Order total</span>
                  <strong className="numeric-text text-2xl text-primary">
                    {formatCurrency(order.totalAmount)}
                  </strong>
                </div>
              </div>
            </section>

            {order.event && (
              <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="font-serif text-xl font-semibold">
                    Event and venue
                  </h2>
                </div>
                <p className="mt-4 font-bold">
                  {order.event.eventName || order.packageName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {eventDate} ·{' '}
                  {order.event.eventTimeStart || 'Time unavailable'}
                </p>
                {order.event.address && (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {order.event.address.addressLine1},{' '}
                    {order.event.address.city}, {order.event.address.state}{' '}
                    {order.event.address.pincode}
                  </p>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <h2 className="font-serif text-xl font-semibold">
                Order progress
              </h2>
              <div className="mt-5 space-y-0">
                {order.statusHistory.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="relative flex gap-3 pb-5 last:pb-0"
                  >
                    {index < order.statusHistory.length - 1 && (
                      <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-accent/45" />
                    )}
                    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white">
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-bold">
                        {formatStatus(entry.toStatus)}
                      </p>
                      <p className="numeric-text mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.changedAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <h2 className="font-serif text-xl font-semibold">
                Receipts and invoices
              </h2>
              <div className="mt-4 space-y-2">
                {documents.map((document) => (
                  <Button
                    key={document.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      downloadAuthenticated(
                        `/orders/${orderId}/documents/${document.id}/download`,
                        session.accessToken,
                      )
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {formatStatus(document.documentType)}
                  </Button>
                ))}
                {!documents.length && (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Documents become available after payment confirmation.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-white p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 truncate text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function MenuItemRow({
  item,
  guestCount,
}: {
  item: OrderSelectedItem;
  guestCount: number;
}) {
  const role = roleCopy[item.role];
  const portions = item.role === 'EXTRA' ? item.quantity : guestCount;
  return (
    <article className="flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ivory text-primary">
        {item.role === 'EXTRA' ? (
          <Sparkles className="h-4 w-4" />
        ) : (
          <Package className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-bold text-charcoal">{item.menuItemName}</h4>
          <span
            className={cn(
              'rounded-full px-2 py-1 text-[10px] font-bold',
              role.style,
            )}
          >
            {role.label}
          </span>
        </div>
        <p className="numeric-text mt-1 text-xs text-muted-foreground">
          {portions} {portions === 1 ? 'portion' : 'portions'}
          {item.replacedMenuItemName &&
            ` · replaces ${item.replacedMenuItemName}`}
        </p>
      </div>
      {item.role === 'EXTRA' && Number(item.totalAdjustmentAmount ?? 0) > 0 && (
        <span className="numeric-text shrink-0 text-sm font-bold text-primary">
          +{formatCurrency(item.totalAdjustmentAmount)}
        </span>
      )}
    </article>
  );
}

function PriceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="numeric-text font-semibold">{value}</span>
    </div>
  );
}
