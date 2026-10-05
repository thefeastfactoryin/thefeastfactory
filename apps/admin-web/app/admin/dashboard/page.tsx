'use client';

import {
  formatTimeOfDay,
  type OperatingRegion,
  type OrderStatus,
} from '@aranyam/shared-types';
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
import { OrderStatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/form';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

type DashboardView = 'agenda' | 'calendar';

type CalendarEvent = {
  id: string;
  bookingNumber: string;
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
    orderStatus: OrderStatus;
    paymentStatus: string;
  }>;
};

type RevenueReport = { netRevenue: number };
type OrderStatusRow = { orderStatus: OrderStatus; _count: number };
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
const monthFormatter = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
});

export default function Dashboard() {
  const session = useAdminSessionStore((state) => state.session);
  const [data, setData] = useState<DashboardData>();
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [regions, setRegions] = useState<OperatingRegion[]>([]);
  const [regionId, setRegionId] = useState('');
  const [periodDate, setPeriodDate] = useState(() => new Date());
  const [view, setView] = useState<DashboardView>('agenda');
  const [error, setError] = useState('');

  const weekStart = useMemo(() => startOfWeek(periodDate), [periodDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = weekDays[6];
  const monthStart = useMemo(() => startOfMonth(periodDate), [periodDate]);
  const monthEnd = useMemo(() => endOfMonth(periodDate), [periodDate]);
  const monthGridStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const monthGridEnd = useMemo(() => endOfWeek(monthEnd), [monthEnd]);
  const monthDays = useMemo(() => {
    const days: Date[] = [];
    for (let day = monthGridStart; day <= monthGridEnd; day = addDays(day, 1)) {
      days.push(day);
    }
    return days;
  }, [monthGridStart, monthGridEnd]);
  const visibleDays = view === 'agenda' ? weekDays : monthDays;
  const rangeStart = visibleDays[0];
  const rangeEnd = visibleDays.at(-1)!;
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
      `/admin/operations/calendar?from=${dateKey(rangeStart)}&to=${dateKey(rangeEnd)}${regionQuery ? `&${regionQuery}` : ''}`,
      {},
      session.accessToken,
    )
      .then(setCalendarEvents)
      .catch((reason) => setError((reason as Error).message));
  }, [session, rangeStart, rangeEnd, regionQuery]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const day of visibleDays) grouped.set(dateKey(day), []);
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
  }, [calendarEvents, visibleDays]);

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
        description="Review upcoming bookings, identify orders that need attention, and open fulfilment details."
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
                {view === 'agenda' ? 'Week' : 'Month'}
              </span>
              <div className="flex min-h-11 items-center justify-between rounded-lg border bg-white px-3">
                <button
                  type="button"
                  onClick={() =>
                    setPeriodDate((current) =>
                      view === 'agenda'
                        ? addDays(current, -7)
                        : addMonths(current, -1),
                    )
                  }
                  className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
                  aria-label={
                    view === 'agenda' ? 'Previous week' : 'Previous month'
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodDate(new Date())}
                  className="px-2 text-sm font-semibold text-primary"
                >
                  {view === 'agenda'
                    ? rangeFormatter.format(weekStart)
                    : monthFormatter.format(monthStart)}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPeriodDate((current) =>
                      view === 'agenda'
                        ? addDays(current, 7)
                        : addMonths(current, 1),
                    )
                  }
                  className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
                  aria-label={view === 'agenda' ? 'Next week' : 'Next month'}
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
              {view === 'agenda'
                ? `${rangeFormatter.format(weekStart)} - ${rangeFormatter.format(weekEnd)}`
                : monthFormatter.format(monthStart)}
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
            { value: 'calendar', label: 'Month calendar', icon: CalendarDays },
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
            <div className="min-w-[980px] overflow-hidden rounded-xl border border-border bg-border">
              <div className="grid grid-cols-7 gap-px" aria-hidden="true">
                {weekDays.map((day) => (
                  <div
                    key={shortDayFormatter.format(day)}
                    className="bg-muted px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {shortDayFormatter.format(day)}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {monthDays.map((day) => {
                  const events = eventsByDay.get(dateKey(day)) ?? [];
                  const isCurrentMonth =
                    day.getMonth() === monthStart.getMonth();
                  const isToday = dateKey(day) === dateKey(new Date());
                  return (
                    <section
                      key={dateKey(day)}
                      className={`min-h-36 bg-white p-2 ${
                        isCurrentMonth
                          ? ''
                          : 'bg-muted/35 text-muted-foreground'
                      }`}
                    >
                      <header className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                            isToday ? 'bg-primary text-white' : ''
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {events.length > 0 && (
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {events.length} booking
                            {events.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </header>
                      <div className="space-y-1.5">
                        {events.slice(0, 3).map((event) => (
                          <Link
                            key={event.id}
                            href={`/admin/bookings/${event.id}`}
                            title={`${timeLabel(event.eventTimeStart)} · ${event.eventName || event.bookingNumber}`}
                            className="block rounded-md border border-primary/10 bg-primary/[0.06] px-2 py-1.5 hover:border-primary/25 hover:bg-primary/10"
                          >
                            <p className="truncate text-[10px] font-bold text-primary">
                              {timeLabel(event.eventTimeStart)}
                            </p>
                            <p className="truncate text-xs font-semibold text-foreground">
                              {event.eventName || event.bookingNumber}
                            </p>
                          </Link>
                        ))}
                        {events.length > 3 && (
                          <p className="px-2 text-[10px] font-bold text-primary">
                            +{events.length - 3} more
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
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
                <OrderStatusBadge value={row.orderStatus} />
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
        <p className="text-xs text-muted-foreground">{event.bookingNumber}</p>
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
        {order && <OrderStatusBadge value={order.orderStatus} />}
        <Button
          asChild
          variant="outline"
          className="h-10 w-10 px-0"
          aria-label={`Open ${event.bookingNumber}`}
        >
          <Link href={`/admin/bookings/${event.id}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
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

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date) {
  const current = new Date(date);
  current.setDate(1);
  current.setHours(0, 0, 0, 0);
  return current;
}

function endOfMonth(date: Date) {
  const current = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  current.setHours(0, 0, 0, 0);
  return current;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
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
  return formatTimeOfDay(value, 'Time TBC');
}
