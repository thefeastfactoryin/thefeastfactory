'use client';

import {
  formatTimeOfDay,
  type OrderDetails,
  type OrderSelectedItem,
} from '@aranyam/shared-types';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../../components/ui/button';
import {
  AuthRequiredPanel,
  StatePanel,
} from '../../../../../components/ui/state-panel';
import { apiRequest } from '../../../../../lib/api';
import {
  formatCurrency,
  formatCustomerBookingStatus,
} from '../../../../../lib/format';
import { sortMenuCategories } from '../../../../../lib/menu-category-order';
import { cn } from '../../../../../lib/utils';
import { useSessionStore } from '../../../../../store/session.store';

const roleCopy = {
  INCLUDED: { label: 'Included', style: 'bg-accent/10 text-gold-text' },
  SWAP: { label: 'Substitution', style: 'bg-emerald-50 text-emerald-700' },
  EXTRA: { label: 'Extra', style: 'bg-primary/[0.07] text-primary' },
  CUSTOM: { label: 'Selected', style: 'bg-muted text-charcoal' },
} as const;

export default function OrderPage() {
  const { bookingId, orderId } = useParams<{
    bookingId: string;
    orderId: string;
  }>();
  const session = useSessionStore((state) => state.session);
  const [order, setOrder] = useState<OrderDetails>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    apiRequest<OrderDetails>(
      `/bookings/${bookingId}/orders/${orderId}`,
      {},
      session.accessToken,
    )
      .then(setOrder)
      .catch((reason) => setError((reason as Error).message));
  }, [bookingId, orderId, session]);

  const menuGroups = useMemo(() => {
    if (!order) return [];
    return sortMenuCategories(
      order.selectedItems.reduce<
        Array<{ name: string; items: OrderSelectedItem[] }>
      >((groups, item) => {
        const group = groups.find((entry) => entry.name === item.categoryName);
        if (group) group.items.push(item);
        else groups.push({ name: item.categoryName, items: [item] });
        return groups;
      }, []),
      (group) => group.name,
    );
  }, [order]);

  if (!session)
    return (
      <AuthRequiredPanel
        title="Sign in to view this order"
        description="Order details are available only to the customer who placed the booking."
        returnHref={`/bookings/${bookingId}/orders/${orderId}`}
      />
    );
  if (error)
    return (
      <main className="page-shell">
        <StatePanel
          tone="danger"
          title="Order could not load"
          description={error}
          actionHref="/bookings"
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
  const deliveryTime = formatTimeOfDay(order.event?.eventTimeStart);
  const publicStatusHistory = order.statusHistory.reduce<
    Array<(typeof order.statusHistory)[number] & { publicLabel: string }>
  >((entries, entry) => {
    const publicLabel = formatCustomerBookingStatus(entry.toStatus);
    if (entries.at(-1)?.publicLabel === publicLabel) return entries;
    entries.push({ ...entry, publicLabel });
    return entries;
  }, []);

  return (
    <main className="min-h-screen bg-background pb-24">
      <section className="relative overflow-hidden bg-hero-end text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_28%,hsl(var(--accent)/0.18),transparent_28%),linear-gradient(100deg,hsl(var(--hero-end)),hsl(var(--primary)))]" />
        <div className="container-pad relative py-7 sm:py-9">
          <Link
            href="/bookings"
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
                {formatCustomerBookingStatus(order.orderStatus)}
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
            label={
              order.packageType === 'ORDER_BY_KG' ? 'Weight' : 'Guests / boxes'
            }
            value={
              order.packageType === 'ORDER_BY_KG'
                ? `${order.selectedItems.reduce((sum, item) => sum + (item.weightGrams ?? 0), 0) / 1000} kg`
                : String(order.guestCount)
            }
          />
          <Fact icon={CalendarDays} label="Event date" value={eventDate} />
          <Fact icon={Clock3} label="Delivery time" value={deliveryTime} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
              <div>
                <p className="eyebrow text-primary">Complete menu</p>
                <h2 className="mt-1 font-sans text-2xl font-semibold">
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
            {order.orderStatus === 'AWAITING_APPROVAL' && (
              <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                <h2 className="font-sans text-xl font-semibold text-amber-950">
                  Awaiting kitchen approval
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-900/80">
                  Your booking request and any payment received are recorded.
                  The kitchen will review availability and update this order.
                </p>
              </section>
            )}

            {order.orderStatus === 'DECLINED' && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <h2 className="font-sans text-xl font-semibold text-red-900">
                  Booking declined
                </h2>
                <p className="mt-2 text-sm leading-6 text-red-800">
                  {order.declineReason ||
                    'The kitchen could not accept this booking.'}
                </p>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <p className="eyebrow text-primary">Price summary</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-end justify-between gap-4 border-t pt-4">
                  <span className="font-bold">Package total</span>
                  <strong className="money-text text-2xl font-extrabold text-primary">
                    {formatCurrency(order.totalAmount)}
                  </strong>
                </div>
                {order.bookingId && (
                  <Button asChild variant="outline" className="mt-3 w-full">
                    <Link href={`/bookings/${order.bookingId}`}>
                      View booking total, payments &amp; invoices
                    </Link>
                  </Button>
                )}
              </div>
            </section>

            {order.event && (
              <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="font-sans text-xl font-semibold">
                    Event and venue
                  </h2>
                </div>
                <p className="mt-4 font-bold">
                  {order.event.eventName || order.packageName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {eventDate} · {deliveryTime}
                </p>
                {order.event.address && (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {order.event.address.addressLine1},{' '}
                    {order.event.address.city}, {order.event.address.state}{' '}
                    {order.event.address.pincode}
                  </p>
                )}
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                  +91 {order.contactNumber}
                </p>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <h2 className="font-sans text-xl font-semibold">
                Order progress
              </h2>
              <div className="mt-5 space-y-0">
                {publicStatusHistory.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="relative flex gap-3 pb-5 last:pb-0"
                  >
                    {index < publicStatusHistory.length - 1 && (
                      <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-accent/45" />
                    )}
                    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white">
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-bold">
                        {entry.publicLabel}
                      </p>
                      <p className="numeric-text mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.changedAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
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
        <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
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
  guestCount: number | null;
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
        <p className="money-text mt-1 text-xs text-muted-foreground">
          {item.weightGrams != null
            ? `${item.weightGrams / 1000} kg · ${formatCurrency(item.pricePerKg)} / kg`
            : `${portions} ${portions === 1 ? 'portion' : 'portions'}`}
          {item.replacedMenuItemName &&
            ` · replaces ${item.replacedMenuItemName}`}
        </p>
      </div>
      {item.lineTotal && (
        <span className="money-text text-sm font-bold text-primary">
          {formatCurrency(item.lineTotal)}
        </span>
      )}
      {item.role === 'EXTRA' && Number(item.totalAdjustmentAmount ?? 0) > 0 && (
        <span className="money-text shrink-0 text-sm font-bold text-primary">
          +{formatCurrency(item.totalAdjustmentAmount)}
        </span>
      )}
    </article>
  );
}
