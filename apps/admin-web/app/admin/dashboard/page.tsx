'use client';

import type { OperatingRegion } from '@aranyam/shared-types';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  IndianRupee,
  ShoppingBag,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/form';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

type CalendarEvent = {
  id: string;
  eventName?: string | null;
  eventDate: string;
  eventTimeStart?: string | null;
  guestCount: number;
  distanceKm?: string | null;
  deliveryFee?: string;
  region?: OperatingRegion | null;
  address: { city: string; addressLine1: string };
  user: { name?: string | null; mobileNumber: string };
  orders: Array<{
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
  }>;
};

type RevenueReport = { netRevenue: number };
type OrderStatusRow = { orderStatus: string; _count: number };
type OrdersReport = { total: number; byStatus: OrderStatusRow[] };
type PaymentsReport = { total: number };
type OperationsQueue = {
  upcomingEvents: CalendarEvent[];
  pendingRefunds: unknown[];
};
type DashboardData = {
  revenue: RevenueReport;
  orders: OrdersReport;
  payments: PaymentsReport;
  queue: OperationsQueue;
};

const dayFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
});
const rangeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function Dashboard() {
  const session = useAdminSessionStore((state) => state.session);
  const [data, setData] = useState<DashboardData>();
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [regions, setRegions] = useState<OperatingRegion[]>([]);
  const [regionId, setRegionId] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [error, setError] = useState('');

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = weekDays[6];
  const effectiveRegionId =
    session?.admin.role === 'OPERATIONS'
      ? (session.admin.regionId ?? '')
      : regionId;
  const regionQuery = effectiveRegionId ? `regionId=${effectiveRegionId}` : '';

  useEffect(() => {
    if (!session) return;
    apiRequest<OperatingRegion[]>(
      '/admin/operating-regions?activeOnly=true',
      {},
      session.accessToken,
    ).then(setRegions);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const suffix = regionQuery ? `?${regionQuery}` : '';
    Promise.all([
      apiRequest<RevenueReport>(
        `/admin/reports/revenue${suffix}`,
        {},
        session.accessToken,
      ),
      apiRequest<OrdersReport>(
        `/admin/reports/orders${suffix}`,
        {},
        session.accessToken,
      ),
      apiRequest<PaymentsReport>(
        `/admin/reports/payments${suffix}`,
        {},
        session.accessToken,
      ),
      apiRequest<OperationsQueue>(
        `/admin/operations/queue${suffix}`,
        {},
        session.accessToken,
      ),
    ])
      .then(([revenue, orders, payments, queue]) =>
        setData({ revenue, orders, payments, queue }),
      )
      .catch((reason) => setError((reason as Error).message));
  }, [session, regionQuery]);

  useEffect(() => {
    if (!session) return;
    apiRequest<CalendarEvent[]>(
      `/admin/operations/calendar?from=${dateKey(weekStart)}&to=${dateKey(weekEnd)}${regionQuery ? `&${regionQuery}` : ''}`,
      {},
      session.accessToken,
    )
      .then(setCalendarEvents)
      .catch((reason) => setError((reason as Error).message));
  }, [session, weekStart, weekEnd, regionQuery]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const day of weekDays) grouped.set(dateKey(day), []);
    for (const event of calendarEvents) {
      const key = event.eventDate.slice(0, 10);
      grouped.get(key)?.push(event);
    }
    for (const events of grouped.values()) {
      events.sort((a, b) =>
        timeLabel(a.eventTimeStart).localeCompare(timeLabel(b.eventTimeStart)),
      );
    }
    return grouped;
  }, [calendarEvents, weekDays]);

  if (!session) return <main className="admin-page">Sign in to continue.</main>;
  if (error) return <main className="admin-page text-red-700">{error}</main>;
  if (!data)
    return <main className="admin-page">Loading operations overview...</main>;

  return (
    <main className="admin-page">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Today&apos;s command center
        </p>
        <h1 className="admin-title mt-2">Operations dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Revenue, upcoming events, payment health, and weekly order tracking in
          one view.
        </p>
      </div>
      <div className="admin-card mt-7 max-w-sm">
        {session.admin.role === 'ADMIN' ? (
          <Select
            value={regionId}
            onChange={(event) => setRegionId(event.target.value)}
          >
            <option value="">All regions</option>
            {regions.map((region) => (
              <option value={region.id} key={region.id}>
                {region.name}
              </option>
            ))}
          </Select>
        ) : (
          <div className="text-sm font-semibold">
            {session.admin.region?.name ?? 'Region not assigned'}
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={IndianRupee}
          label="Net revenue"
          value={`₹${data.revenue.netRevenue ?? '0.00'}`}
        />
        <Metric
          icon={ShoppingBag}
          label="Total orders"
          value={data.orders.total ?? 0}
        />
        <Metric
          icon={CreditCard}
          label="Payments"
          value={data.payments.total ?? 0}
        />
        <Metric
          icon={AlertTriangle}
          label="Pending refunds"
          value={data.queue.pendingRefunds.length}
        />
      </div>

      <section className="admin-card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Weekly order calendar</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {rangeFormatter.format(weekStart)} -{' '}
              {rangeFormatter.format(weekEnd)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              This week
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-7">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className="min-h-[260px] rounded-xl border bg-white p-3"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {dayFormatter.format(day)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dateFormatter.format(day)}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                    {dayEvents.length}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {dayEvents.map((event) => {
                    const order = event.orders[0];
                    return (
                      <article
                        key={event.id}
                        className="rounded-xl border-l-4 border-primary bg-muted/45 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-primary">
                              {timeLabel(event.eventTimeStart)}
                            </p>
                            <h3 className="mt-1 text-sm font-semibold">
                              {event.eventName || 'Catering event'}
                            </h3>
                          </div>
                          {order && <StatusBadge value={order.orderStatus} />}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {event.address.city} · {event.guestCount} guests
                        </p>
                        {event.region && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.region.name} · {event.distanceKm} km
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {event.user.name || event.user.mobileNumber}
                        </p>
                        {order ? (
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="mt-3 inline-flex text-xs font-semibold text-primary"
                          >
                            {order.orderNumber}
                          </Link>
                        ) : (
                          <p className="mt-3 text-xs font-semibold text-muted-foreground">
                            No order placed
                          </p>
                        )}
                      </article>
                    );
                  })}
                  {!dayEvents.length && (
                    <p className="pt-8 text-center text-sm text-muted-foreground">
                      No orders
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <section className="admin-card">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Upcoming events</h2>
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 space-y-3">
            {data.queue.upcomingEvents.slice(0, 7).map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/55 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {event.eventName || 'Catering event'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.eventDate).toLocaleDateString('en-IN')} ·{' '}
                    {event.address.city} · {event.guestCount} guests
                  </p>
                </div>
                {event.orders[0] && (
                  <StatusBadge value={event.orders[0].orderStatus} />
                )}
              </div>
            ))}
            {!data.queue.upcomingEvents.length && (
              <p className="py-8 text-center text-muted-foreground">
                No events in the next seven days.
              </p>
            )}
          </div>
        </section>
        <section className="admin-card">
          <h2 className="text-xl font-semibold">Order status</h2>
          <div className="mt-4 space-y-3">
            {data.orders.byStatus.map((row) => (
              <div
                key={row.orderStatus}
                className="flex items-center justify-between rounded-xl border p-3"
              >
                <StatusBadge value={row.orderStatus} />
                <strong>{row._count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string | number;
}) {
  return (
    <div className="admin-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - day + 1);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeLabel(value?: string | null) {
  if (!value) return 'Time TBC';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return value.slice(0, 5);
}
