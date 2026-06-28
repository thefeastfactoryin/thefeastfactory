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
import { StatusBadge } from '../../../components/status-badge';
import { Select } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

const pageSize = 20;
type AdminOrder = OrderSummary & { user?: { name?: string | null; mobileNumber: string } };

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
    ).then(setRegions);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      apiRequest<PaginatedResponse<AdminOrder>>(
        `/admin/orders${query ? `?${query}` : ''}`,
        {},
        session.accessToken,
      ).then(setResult);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [session, query]);

  useEffect(() => setPage(1), [status, paymentStatus, mobile, city, dateFrom, dateTo, effectiveRegionId]);

  if (!session) return <main className="admin-page">Sign in to continue.</main>;

  return (
    <main className="admin-page">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        Fulfilment
      </p>
      <h1 className="admin-title mt-2">Orders</h1>
      <div className="admin-card mt-7 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Input
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder="Search customer mobile"
        />
        <Input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="Search city"
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
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
          <div className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">
            {session.admin.region?.name ?? 'Region not assigned'}
          </div>
        )}
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All order statuses</option>
          {orderStatusOptions.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select
          value={paymentStatus}
          onChange={(event) => setPaymentStatus(event.target.value)}
        >
          <option value="">All payment statuses</option>
          {paymentStatusOptions.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </div>

      <div className="admin-card mt-5 overflow-x-auto p-0">
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
                </td>
                <td>
                  {order.user?.name || order.user?.mobileNumber}
                  <span className="block text-xs text-muted-foreground">
                    {order.user?.mobileNumber}
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
        {!result.items.length && (
          <p className="p-10 text-center text-muted-foreground">
            No orders match these filters.
          </p>
        )}
      </div>
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
