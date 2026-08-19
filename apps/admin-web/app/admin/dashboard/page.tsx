'use client';

import type { OperatingRegion } from '@aranyam/shared-types';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  IndianRupee,
  List,
  MapPin,
  ShoppingBag,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../../../components/admin-page-header';
import { AdminSectionTabs } from '../../../components/admin-section-tabs';
import { StatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/form';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

type DashboardView = 'agenda' | 'calendar';

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
  failedPayments: unknown[];
  pendingRefunds: unknown[];
};
type DashboardData = {
  revenue: RevenueReport;
  orders: OrdersReport;
  payments: PaymentsReport;
  queue: OperationsQueue;
};

const dayFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'long' });
const shortDayFormatter = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
});
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
  const [view, setView] = useState<DashboardView>('agenda');
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
    )
      .then(setRegions)
      .catch((reason) => setError((reason as Error).message));
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

  const attentionCount =
    data.queue.failedPayments.length + data.queue.pendingRefunds.length;

  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Review the week, identify orders that need attention, and open fulfilment details."
        filters={
          <>
            <label className="min-w-[220px] flex-1 sm:max-w-xs">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Kitchen region
              </span>
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
                <div className="flex min-h-11 items-center rounded-lg border bg-muted px-3.5 text-sm font-semibold text-muted-foreground">
                  {session.admin.region?.name ?? 'Region not assigned'}
                </div>
              )}
            </label>
            <div className="min-w-[220px] flex-1 sm:max-w-xs">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Week
              </span>
              <div className="flex min-h-11 items-center justify-between rounded-lg border bg-white px-3">
                <button
                  type="button"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
                  className="px-2 text-sm font-semibold text-primary"
                >
                  {rangeFormatter.format(weekStart)}
                </button>
                <button
                  type="button"
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                  className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        }
      />

      <section
        className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Operational summary"
      >
        <Metric
          icon={IndianRupee}
          label="Lifetime net revenue"
          value={`₹${data.revenue.netRevenue ?? '0.00'}`}
        />
        <Metric
          icon={ShoppingBag}
          label="All confirmed orders"
          value={data.orders.total ?? 0}
        />
        <Metric
          icon={CalendarDays}
          label="Events in next 7 days"
          value={data.queue.upcomingEvents.length}
        />
        <Metric
          icon={AlertTriangle}
          label="Needs attention"
          value={attentionCount}
          tone={attentionCount ? 'warning' : 'default'}
        />
      </section>

      <section className="admin-card mt-5 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <div>
            <h2 className="text-xl font-semibold">Order schedule</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {rangeFormatter.format(weekStart)} -{' '}
              {rangeFormatter.format(weekEnd)}
            </p>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {calendarEvents.length} order
            {calendarEvents.length === 1 ? '' : 's'}
          </p>
        </div>
        <AdminSectionTabs
          value={view}
          onChange={setView}
          label="Dashboard view"
          className="mt-3 px-2"
          tabs={[
            { value: 'agenda', label: 'Agenda', icon: List },
            { value: 'calendar', label: 'Week calendar', icon: CalendarDays },
          ]}
        />

        {view === 'agenda' ? (
          <div
            id="dashboard-view-agenda-panel"
            role="tabpanel"
            aria-labelledby="dashboard-view-agenda-tab"
            className="divide-y"
          >
            {weekDays.map((day) => {
              const events = eventsByDay.get(dateKey(day)) ?? [];
              return (
                <section
                  key={dateKey(day)}
                  className="grid gap-3 p-4 lg:grid-cols-[150px_1fr]"
                >
                  <div>
                    <h3 className="font-semibold">
                      {dayFormatter.format(day)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {dateFormatter.format(day)} · {events.length} order
                      {events.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <AgendaRow event={event} key={event.id} />
                    ))}
                    {!events.length && (
                      <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                        No orders scheduled.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div
            id="dashboard-view-calendar-panel"
            role="tabpanel"
            aria-labelledby="dashboard-view-calendar-tab"
            className="overflow-x-auto p-4"
          >
            <div className="grid min-w-[1080px] grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const events = eventsByDay.get(dateKey(day)) ?? [];
                return (
                  <section
                    key={dateKey(day)}
                    className="min-h-[300px] rounded-lg border bg-white"
                  >
                    <header className="border-b bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold">
                            {shortDayFormatter.format(day)}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {dateFormatter.format(day)}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">
                          {events.length}
                        </span>
                      </div>
                    </header>
                    <div className="space-y-2 p-2">
                      {events.map((event) => {
                        const order = event.orders[0];
                        return (
                          <Link
                            key={event.id}
                            href={
                              order
                                ? `/admin/orders/${order.id}`
                                : '/admin/orders'
                            }
                            className="block rounded-md border-l-4 border-primary bg-muted/40 p-2.5 hover:bg-muted"
                          >
                            <p className="text-xs font-semibold text-primary">
                              {timeLabel(event.eventTimeStart)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm font-semibold">
                              {event.eventName || 'Catering event'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {event.guestCount} guests · {event.address.city}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className="admin-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Needs attention</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Resolve payment and refund exceptions.
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 divide-y rounded-lg border">
            <AttentionRow
              icon={CreditCard}
              label="Failed payments"
              count={data.queue.failedPayments.length}
              href="/admin/payments"
            />
            <AttentionRow
              icon={IndianRupee}
              label="Refunds processing"
              count={data.queue.pendingRefunds.length}
              href="/admin/payments"
            />
          </div>
        </section>

        <section className="admin-card">
          <h2 className="text-xl font-semibold">Order status</h2>
          <div className="mt-4 space-y-2">
            {data.orders.byStatus.map((row) => (
              <div
                key={row.orderStatus}
                className="flex items-center justify-between rounded-lg border px-3 py-2.5"
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

function AgendaRow({ event }: { event: CalendarEvent }) {
  const order = event.orders[0];
  return (
    <article className="grid gap-3 rounded-lg border bg-white p-3 md:grid-cols-[88px_minmax(180px,1fr)_minmax(160px,.8fr)_auto] md:items-center">
      <div>
        <p className="font-semibold text-primary">
          {timeLabel(event.eventTimeStart)}
        </p>
        <p className="text-xs text-muted-foreground">
          {order?.orderNumber ?? 'No order'}
        </p>
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {event.eventName || 'Catering event'}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {event.address.city}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {event.guestCount} guests
          </span>
        </p>
      </div>
      <div className="text-sm">
        <p className="font-medium">
          {event.region?.name ?? 'Kitchen unassigned'}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.user.name || event.user.mobileNumber}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        {order && <StatusBadge value={order.orderStatus} />}
        {order && (
          <Button
            asChild
            variant="outline"
            className="h-10 w-10 px-0"
            aria-label={`Open ${order.orderNumber}`}
          >
            <Link href={`/admin/orders/${order.id}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

function AttentionRow({
  icon: Icon,
  label,
  count,
  href,
}: {
  icon: typeof CreditCard;
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-semibold">{label}</span>
      </span>
      <span className="flex items-center gap-2">
        <strong>{count}</strong>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </span>
    </Link>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string | number;
  tone?: 'default' | 'warning';
}) {
  return (
    <article className="admin-card flex min-h-[116px] items-center gap-4">
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-primary/10 text-primary'}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
      </div>
    </article>
  );
}

function startOfWeek(date: Date) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  current.setHours(0, 0, 0, 0);
  return current;
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
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
