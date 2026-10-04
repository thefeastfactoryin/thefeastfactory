'use client';

import type {
  BookingStatus,
  BookingSummary,
  OperatingRegion,
  PaginatedResponse,
} from '@aranyam/shared-types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../../../components/admin-page-header';
import { StatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

const statuses: BookingStatus[] = [
  'AWAITING_APPROVAL',
  'CONFIRMED',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
  'NEEDS_REVIEW',
];

export default function AdminBookingsPage() {
  const session = useAdminSessionStore((state) => state.session);
  const [result, setResult] = useState<PaginatedResponse<BookingSummary>>({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [status, setStatus] = useState('');
  const [mobile, setMobile] = useState('');
  const [regionId, setRegionId] = useState('');
  const [regions, setRegions] = useState<OperatingRegion[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const effectiveRegion =
    session?.admin.role === 'OPERATIONS'
      ? (session.admin.regionId ?? '')
      : regionId;
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (status) params.set('status', status);
    if (mobile) params.set('mobileNumber', mobile);
    if (effectiveRegion) params.set('regionId', effectiveRegion);
    return params.toString();
  }, [effectiveRegion, mobile, page, status]);

  useEffect(() => {
    if (!session || session.admin.role !== 'ADMIN') return;
    apiRequest<OperatingRegion[]>(
      '/admin/operating-regions?activeOnly=true',
      {},
      session.accessToken,
    )
      .then(setRegions)
      .catch(() => undefined);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    apiRequest<PaginatedResponse<BookingSummary>>(
      `/admin/bookings?${query}`,
      {},
      session.accessToken,
    )
      .then(setResult)
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, [query, session]);

  if (!session) return <main className="admin-page">Sign in to continue.</main>;

  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="Operations"
        title="Bookings"
        description="Approve and manage the complete customer booking while package orders remain available for kitchen fulfilment."
      />
      <section className="admin-card mt-6 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
          >
            <option value="">All booking statuses</option>
            {statuses.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <Input
            value={mobile}
            onChange={(event) => {
              setMobile(event.target.value);
              setPage(1);
            }}
            placeholder="Customer mobile"
          />
          {session.admin.role === 'ADMIN' && (
            <select
              value={regionId}
              onChange={(event) => {
                setRegionId(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
            >
              <option value="">All kitchens</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <section className="admin-card mt-5 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading bookings…</p>
        ) : !result.items.length ? (
          <p className="p-6 text-sm text-muted-foreground">
            No bookings match these filters.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {result.items.map((booking) => (
              <Link
                key={booking.id}
                href={`/admin/bookings/${booking.id}`}
                className="grid gap-3 p-5 hover:bg-muted/30 md:grid-cols-[1.2fr_1fr_.8fr_.8fr_.7fr] md:items-center"
              >
                <div>
                  <p className="font-semibold text-primary">
                    {booking.bookingNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.user?.name || booking.contactNumber} ·{' '}
                    {booking.orders.length} packages
                  </p>
                </div>
                <div className="text-sm">
                  {new Date(booking.eventDate).toLocaleDateString('en-IN')}
                  <p className="text-muted-foreground">
                    {booking.addressSnapshot.city}
                  </p>
                </div>
                <StatusBadge value={booking.status} />
                <StatusBadge value={booking.paymentStatus} />
                <p className="text-right font-semibold">
                  ₹{Number(booking.totalAmount).toLocaleString('en-IN')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className="mt-5 flex items-center justify-between">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {result.page} of {result.totalPages}
        </span>
        <Button
          variant="outline"
          disabled={page >= result.totalPages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </Button>
      </div>
    </main>
  );
}
