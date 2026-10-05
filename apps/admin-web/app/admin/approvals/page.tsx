'use client';

import type {
  BookingSummary,
  OperatingRegion,
  PaginatedResponse,
} from '@aranyam/shared-types';
import { formatTimeOfDay } from '@aranyam/shared-types';
import { CalendarDays, Check, ChefHat, MapPin, Package } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../../../components/admin-page-header';
import { StatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

const PAGE_SIZE = 30;

export default function BookingApprovalsPage() {
  const session = useAdminSessionStore((state) => state.session);
  const [result, setResult] = useState<PaginatedResponse<BookingSummary>>({
    items: [],
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [regions, setRegions] = useState<OperatingRegion[]>([]);
  const [regionId, setRegionId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const effectiveRegionId =
    session?.admin.role === 'OPERATIONS'
      ? (session.admin.regionId ?? '')
      : regionId;
  const query = useMemo(() => {
    const params = new URLSearchParams({
      status: 'AWAITING_APPROVAL',
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (effectiveRegionId) params.set('regionId', effectiveRegionId);
    return params.toString();
  }, [effectiveRegionId, page]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const next = await apiRequest<PaginatedResponse<BookingSummary>>(
        `/admin/bookings?${query}`,
        {},
        session.accessToken,
      );
      setResult(next);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, session]);

  useEffect(() => {
    if (!session || session.admin.role !== 'ADMIN') return;
    apiRequest<OperatingRegion[]>(
      '/admin/operating-regions?activeOnly=true',
      {},
      session.accessToken,
    )
      .then(setRegions)
      .catch((reason) => setError((reason as Error).message));
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(booking: BookingSummary) {
    if (!session) return;
    setBusyId(booking.id);
    setError('');
    try {
      await apiRequest(
        `/admin/bookings/${booking.id}/approve`,
        { method: 'POST' },
        session.accessToken,
      );
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusyId('');
    }
  }

  if (!session) return <main className="admin-page">Sign in to continue.</main>;

  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="Operations"
        title="Booking approvals"
        description="Review new customer bookings by kitchen and confirm them for fulfilment."
        filters={
          <label className="min-w-[240px] flex-1 sm:max-w-xs">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Kitchen region
            </span>
            {session.admin.role === 'ADMIN' ? (
              <select
                className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
                value={regionId}
                onChange={(event) => {
                  setRegionId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All kitchens</option>
                {regions.map((region) => (
                  <option value={region.id} key={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex min-h-11 items-center rounded-lg border bg-muted px-3.5 text-sm font-semibold text-muted-foreground">
                {session.admin.region?.name ?? 'Region not assigned'}
              </div>
            )}
          </label>
        }
      />

      <section className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-amber-900">
            {result.total} booking{result.total === 1 ? '' : 's'} awaiting
            confirmation
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Approval confirms every package within the booking.
          </p>
        </div>
        <StatusBadge value="AWAITING_APPROVAL" label="Awaiting approval" />
      </section>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        {loading ? (
          <p className="admin-card col-span-full p-6 text-sm text-muted-foreground">
            Loading approval queue…
          </p>
        ) : !result.items.length ? (
          <div className="admin-card col-span-full p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Queue is clear</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              There are no bookings awaiting approval for this region.
            </p>
          </div>
        ) : (
          result.items.map((booking) => (
            <article className="admin-card p-5" key={booking.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {booking.bookingNumber}
                  </Link>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {booking.user?.name || booking.contactNumber} ·{' '}
                    {booking.contactNumber}
                  </p>
                </div>
                <strong className="shrink-0 text-lg">
                  ₹{Number(booking.totalAmount).toLocaleString('en-IN')}
                </strong>
              </div>

              <div className="mt-4 grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2">
                <Fact
                  icon={CalendarDays}
                  label="Event"
                  value={`${new Date(booking.eventDate).toLocaleDateString('en-IN')} · ${formatTimeOfDay(booking.eventTimeStart, 'Time pending')}`}
                />
                <Fact
                  icon={MapPin}
                  label="Delivery"
                  value={`${booking.addressSnapshot.city}, ${booking.addressSnapshot.pincode}`}
                />
                <Fact
                  icon={Package}
                  label="Packages"
                  value={`${booking.orders.length} package${booking.orders.length === 1 ? '' : 's'}`}
                />
                <Fact
                  icon={ChefHat}
                  label="Kitchen"
                  value={booking.region?.name || 'Region unassigned'}
                />
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button asChild variant="outline">
                  <Link href={`/admin/bookings/${booking.id}`}>
                    Review details
                  </Link>
                </Button>
                <Button
                  disabled={Boolean(busyId)}
                  onClick={() => approve(booking)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {busyId === booking.id ? 'Approving…' : 'Approve booking'}
                </Button>
              </div>
            </article>
          ))
        )}
      </section>

      {result.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {result.page} of {result.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= result.totalPages || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </main>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate font-semibold">{value}</p>
      </div>
    </div>
  );
}
