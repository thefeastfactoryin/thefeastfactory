'use client';
import {
  formatTimeOfDay,
  statusLabels,
  type OrderDetails,
  type OrderStatus,
} from '@aranyam/shared-types';
import {
  CalendarDays,
  Clock3,
  MapPin,
  MessageSquareText,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  OrderStatusBadge,
} from '../../../../../../components/status-badge';
import { Button } from '../../../../../../components/ui/button';
import { apiRequest } from '../../../../../../lib/api';
import { useAdminSessionStore } from '../../../../../../store/session.store';

function fulfilmentLabel(value: OrderStatus) {
  return (
    statusLabels.order[value as keyof typeof statusLabels.order] ??
    value.replaceAll('_', ' ')
  );
}

export default function AdminOrderDetail() {
  const { bookingId, orderId } = useParams<{
    bookingId: string;
    orderId: string;
  }>();
  const session = useAdminSessionStore((state) => state.session);
  const [order, setOrder] = useState<OrderDetails>();
  const load = async () => {
    if (!session) return;
    const nextOrder = await apiRequest<OrderDetails>(
      `/admin/bookings/${bookingId}/orders/${orderId}`,
      {},
      session.accessToken,
    );
    setOrder(nextOrder);
  };
  useEffect(() => {
    load();
  }, [session, bookingId, orderId]);
  if (!order) return <main className="admin-page">Loading order...</main>;
  const address = order.event?.address;
  const eventDate = order.event?.eventDate
    ? new Date(order.event.eventDate).toLocaleDateString('en-IN')
    : 'Not scheduled';
  const eventTime = formatTimeOfDay(
    order.event?.eventTimeStart,
    'Not scheduled',
  );
  const venue = [
    address?.addressLine1,
    address?.city,
    address?.state,
    address?.pincode,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <main className="admin-page">
      <section className="print-ticket" aria-label="Kitchen print ticket">
        <header className="print-ticket-header">
          <strong>The Feast Factory</strong>
          <span>KITCHEN ORDER</span>
        </header>
        <div className="print-ticket-rule" />
        <div className="print-ticket-row print-ticket-order">
          <strong>{order.orderNumber}</strong>
          <strong>{fulfilmentLabel(order.orderStatus)}</strong>
        </div>
        <div className="print-ticket-row">
          <span>Date</span>
          <strong>{eventDate}</strong>
        </div>
        <div className="print-ticket-row">
          <span>Time</span>
          <strong>{eventTime}</strong>
        </div>
        <div className="print-ticket-row">
          <span>
            {order.packageType === 'ORDER_BY_KG' ? 'Ordering' : 'Guests'}
          </span>
          <strong>
            {order.packageType === 'ORDER_BY_KG' ? 'By KG' : order.guestCount}
          </strong>
        </div>
        <div className="print-ticket-rule" />
        <p className="print-ticket-label">CUSTOMER</p>
        <p>{order.user.name || 'Customer'}</p>
        <p>{order.contactNumber}</p>
        {order.event?.eventName && <p>{order.event.eventName}</p>}
        {venue && <p>{venue}</p>}
        <div className="print-ticket-rule" />
        <p className="print-ticket-label">ITEMS</p>
        {order.selectedItems.map((item) => (
          <div className="print-ticket-item" key={item.id}>
            <span>
              {item.weightGrams != null
                ? `${item.weightGrams / 1000} kg`
                : `${item.role === 'EXTRA' ? item.quantity : (order.guestCount ?? item.quantity)} x`}{' '}
              {item.menuItemName}
              {item.role === 'EXTRA'
                ? ' (EXTRA)'
                : item.role === 'SWAP'
                  ? ` (SWAP${item.replacedMenuItemName ? ` FOR ${item.replacedMenuItemName}` : ''})`
                  : ''}
            </span>
            <span>{item.isVeg ? 'VEG' : 'NON-VEG'}</span>
          </div>
        ))}
        {order.cutleryItems?.some(
          (item) => item.includedQuantity > 0 || item.extraQuantity > 0,
        ) && (
          <>
            <div className="print-ticket-rule" />
            <p className="print-ticket-label">CUTLERY &amp; SERVING</p>
            {order.cutleryItems
              .filter(
                (item) => item.includedQuantity > 0 || item.extraQuantity > 0,
              )
              .map((item) => (
                <div className="print-ticket-item" key={item.id}>
                  <span>{item.itemName}</span>
                  <span>
                    {item.includedQuantity > 0
                      ? `${item.includedQuantity} included`
                      : ''}
                    {item.includedQuantity > 0 && item.extraQuantity > 0
                      ? ' + '
                      : ''}
                    {item.extraQuantity > 0
                      ? `${item.extraQuantity} extra`
                      : ''}
                  </span>
                </div>
              ))}
          </>
        )}
        <div className="print-ticket-rule" />
        <p className="print-ticket-label">KITCHEN INSTRUCTIONS</p>
        <p>{order.specialNotes?.trim() || 'None'}</p>
        {order.region?.name && (
          <p className="print-ticket-footer">Kitchen: {order.region.name}</p>
        )}
      </section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Order detail
          </p>
          <h1 className="admin-title mt-2">{order.orderNumber}</h1>
          <p className="mt-2 text-muted-foreground">
            {order.user.name || order.contactNumber} · {order.packageName} ·{' '}
            {order.packageType === 'ORDER_BY_KG' ? 'By KG' : order.guestCount}
            {order.packageType === 'ORDER_BY_KG' ? '' : ' guests'}
          </p>
          {order.region && (
            <p className="mt-1 text-sm text-muted-foreground">
              {order.region.name} kitchen · {order.distanceKm} km · delivery ₹
              {order.deliveryFee}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            title="Print a kitchen ticket on the configured POS printer"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print kitchen ticket
          </Button>
          <OrderStatusBadge value={order.orderStatus} />
        </div>
      </div>
      <section
        className="admin-card mt-5 border-primary/20 bg-primary/[0.04]"
        aria-label="Delivery schedule"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          Delivery schedule
        </p>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Delivery date</p>
              <p className="font-semibold">{eventDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Delivery time</p>
              <p className="font-semibold">{eventTime}</p>
            </div>
          </div>
        </div>
      </section>
      {order.orderStatus === 'AWAITING_APPROVAL' && order.bookingId && (
        <section className="admin-card mt-5 border-amber-300 bg-amber-50/70">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-900">
                Kitchen approval required
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Review availability before accepting this booking
              </h2>
              <p className="mt-1 text-sm text-amber-900/75">
                Approval and any refund decision apply to the complete booking.
              </p>
            </div>
            <Button asChild>
              <Link href={`/admin/bookings/${order.bookingId}`}>
                Review booking
              </Link>
            </Button>
          </div>
        </section>
      )}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-6">
          <section className="admin-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Fulfilment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fulfilment is shared by every package and is managed from
                    the booking.
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/admin/bookings/${order.bookingId}`}>
                    Manage booking fulfilment
                  </Link>
                </Button>
            </div>
          </section>
          <section className="admin-card border-amber-300 bg-amber-50/70">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">Kitchen instructions</h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Customer request · applies to the entire order
                </p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap rounded-xl border border-amber-200 bg-white p-4 text-sm leading-6 text-foreground">
              {order.specialNotes?.trim() || 'No special request provided.'}
            </p>
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
                      {item.isVeg ? 'Vegetarian' : 'Non-vegetarian'} ·{' '}
                      {item.role === 'EXTRA'
                        ? `${item.quantity} portions · Extra`
                        : item.role === 'SWAP'
                          ? `${order.guestCount ?? item.quantity} portions · Swap${item.replacedMenuItemName ? ` for ${item.replacedMenuItemName}` : ''}`
                          : `${order.guestCount ?? item.quantity} portions · Included`}
                    </p>
                  </div>
                  <span>
                    {item.weightGrams != null
                      ? `${item.weightGrams / 1000} kg × ₹${item.pricePerKg}/kg = ₹${item.lineTotal}`
                      : item.role === 'EXTRA'
                        ? `+₹${item.totalAdjustmentAmount}`
                        : 'Included'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t pt-4 text-sm">
              {order.cutleryItems?.some(
                (item) => item.includedQuantity > 0 || item.extraQuantity > 0,
              ) && (
                <div className="space-y-2 pb-2">
                  <p className="font-semibold">Cutlery &amp; serving</p>
                  {order.cutleryItems
                    .filter(
                      (item) =>
                        item.includedQuantity > 0 || item.extraQuantity > 0,
                    )
                    .map((item) => (
                      <div className="flex justify-between" key={item.id}>
                        <span className="text-muted-foreground">
                          {item.itemName}
                          {item.extraQuantity > 0
                            ? ` · ${item.extraQuantity} extra`
                            : ` · ${item.includedQuantity} included`}
                        </span>
                        <span>₹{item.lineTotal}</span>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cutlery total</span>
                <span>₹{order.cutleryTotal ?? '0.00'}</span>
              </div>
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
                  <OrderStatusBadge value={entry.toStatus} />
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
          {order.bookingId && (
            <section className="admin-card">
              <h2 className="text-xl font-semibold">Booking finance &amp; documents</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Payments, GST invoices, receipts, delivery, cutlery, and internal notes are managed once for the complete booking.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link href={`/admin/bookings/${order.bookingId}`}>
                  Open booking
                </Link>
              </Button>
            </section>
          )}
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
        </aside>
      </div>
    </main>
  );
}
