'use client';

import {
  OperatingRegion,
  OrderSummary,
  PaginatedResponse,
  orderStatusOptions,
  paymentStatusOptions,
} from '@aranyam/shared-types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../../../components/admin-page-header';
import { StatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { Field, Select } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

const pageSize = 20;
type AdminOrder = OrderSummary & {
  user?: { name?: string | null; mobileNumber: string };
};
const visibleOrderStatusOptions = orderStatusOptions.filter(
  (value) => value !== 'PENDING_PAYMENT',
);

export default function AdminOrders() {
  const session = useAdminSessionStore((state) => state.session);
  const [result, setResult] = useState<PaginatedResponse<AdminOrder>>({
    items: [],
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
  });
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [regionId, setRegionId] = useState('');
  const [regions, setRegions] = useState<OperatingRegion[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const effectiveRegionId =
    session?.admin.role === 'OPERATIONS'
      ? (session.admin.regionId ?? '')
      : regionId;
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('orderStatus', status);
    if (paymentStatus) params.set('paymentStatus', paymentStatus);
    if (mobile) params.set('mobileNumber', mobile);
    if (city) params.set('city', city);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (effectiveRegionId) params.set('regionId', effectiveRegionId);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return params.toString();
  }, [
    status,
    paymentStatus,
    mobile,
    city,
    dateFrom,
    dateTo,
    effectiveRegionId,
    page,
  ]);

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
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      apiRequest<PaginatedResponse<AdminOrder>>(
        `/admin/orders${query ? `?${query}` : ''}`,
        {},
        session.accessToken,
      )
        .then(setResult)
        .catch((reason) => setError((reason as Error).message))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [session, query]);

  useEffect(
    () => setPage(1),
    [status, paymentStatus, mobile, city, dateFrom, dateTo, effectiveRegionId],
  );

  if (!session) return <main className="admin-page">Sign in to continue.</main>;

  const hasFilters = Boolean(
    status || paymentStatus || mobile || city || dateFrom || dateTo || regionId,
  );

  function clearFilters() {
    setStatus('');
    setPaymentStatus('');
    setMobile('');
    setCity('');
    setDateFrom('');
    setDateTo('');
    setRegionId('');
  }

  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="Fulfilment"
        title="Orders"
        description="Find an event, confirm its kitchen assignment, and open the fulfilment details."
      />
      <section className="admin-card mt-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Customer mobile">
            <Input
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder="Search mobile number"
              inputMode="tel"
            />
          </Field>
          <Field label="City">
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Search city"
            />
          </Field>
          <Field label="Event date from">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </Field>
          <Field label="Event date to">
            <Input
              type="date"
              min={dateFrom || undefined}
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </Field>
          {session.admin.role === 'ADMIN' ? (
            <Field label="Kitchen region">
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
            </Field>
          ) : (
            <Field label="Kitchen region">
              <div className="flex min-h-11 items-center rounded-xl border bg-muted/50 px-3 text-sm font-semibold">
                {session.admin.region?.name ?? 'Region not assigned'}
              </div>
            </Field>
          )}
          <Field label="Order status">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All order statuses</option>
              {visibleOrderStatusOptions.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment status">
            <Select
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
            >
              <option value="">All payment statuses</option>
              {paymentStatusOptions.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!hasFilters}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
          {loading
            ? 'Loading orders…'
            : `${result.total} order${result.total === 1 ? '' : 's'} found`}
        </p>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}
      </section>

      <div className="admin-card mt-5 hidden overflow-x-auto p-0 md:block">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Event</th>
              <th>Customer</th>
              <th>Region</th>
              <th>Status</th>
              <th>Payment</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-semibold text-primary"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td>
                  {order.event?.eventName || order.packageName}
                  <span className="block text-xs text-muted-foreground">
                    {order.event?.eventDate
                      ? new Date(order.event.eventDate).toLocaleDateString(
                          'en-IN',
                        )
                      : ''}
                  </span>
                  {order.specialNotes && (
                    <span className="mt-1 block max-w-xs truncate text-xs font-semibold text-amber-800">
                      Kitchen note: {order.specialNotes}
                    </span>
                  )}
                </td>
                <td>
                  {order.user?.name || order.contactNumber}
                  <span className="block text-xs text-muted-foreground">
                    {order.contactNumber}
                  </span>
                </td>
                <td>
                  {order.region?.name || '—'}
                  <span className="block text-xs text-muted-foreground">
                    {order.distanceKm
                      ? `${order.distanceKm} km · ₹${order.deliveryFee}`
                      : ''}
                  </span>
                </td>
                <td>
                  <StatusBadge value={order.orderStatus} />
                </td>
                <td>
                  <StatusBadge value={order.paymentStatus} />
                </td>
                <td className="text-right font-semibold">
                  ₹{order.totalAmount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !result.items.length && (
          <p className="p-10 text-center text-muted-foreground">
            No orders match these filters.
          </p>
        )}
      </div>
      <section className="mt-5 grid gap-3 md:hidden" aria-label="Order results">
        {result.items.map((order) => (
          <article key={order.id} className="admin-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-semibold text-primary"
                >
                  {order.orderNumber}
                </Link>
                <p className="mt-1 text-sm font-medium">
                  {order.event?.eventName || order.packageName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.event?.eventDate
                    ? new Date(order.event.eventDate).toLocaleDateString(
                        'en-IN',
                      )
                    : 'Event date not set'}
                </p>
              </div>
              <p className="font-semibold">₹{order.totalAmount}</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Customer</dt>
                <dd className="mt-1 font-medium">
                  {order.user?.name || order.contactNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Kitchen</dt>
                <dd className="mt-1 font-medium">
                  {order.region?.name || 'Unassigned'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Order</dt>
                <dd className="mt-1">
                  <StatusBadge value={order.orderStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Payment</dt>
                <dd className="mt-1">
                  <StatusBadge value={order.paymentStatus} />
                </dd>
              </div>
            </dl>
            {order.specialNotes && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                Kitchen note: {order.specialNotes}
              </p>
            )}
            <Button asChild className="mt-4 w-full">
              <Link href={`/admin/orders/${order.id}`}>
                Open fulfilment details
              </Link>
            </Button>
          </article>
        ))}
        {!loading && !result.items.length && (
          <div className="admin-card py-10 text-center text-muted-foreground">
            No orders match these filters.
          </div>
        )}
      </section>
      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {result.totalPages} · {result.total} orders
          </span>
          <button
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            disabled={page === result.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}
