'use client';

import {
  type AdminPayment,
  OperatingRegion,
  refundReasonOptions,
} from '@aranyam/shared-types';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../../../components/admin-page-header';
import { StatusBadge } from '../../../components/status-badge';
import { Button } from '../../../components/ui/button';
import { Field, Select, Textarea } from '../../../components/ui/form';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

export default function Payments() {
  const session = useAdminSessionStore((state) => state.session);
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [selected, setSelected] = useState<AdminPayment>();
  const [reason, setReason] = useState('Customer request');
  const [customReason, setCustomReason] = useState('');
  const [regions, setRegions] = useState<OperatingRegion[]>([]);
  const [regionId, setRegionId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const effectiveRegionId =
    session?.admin.role === 'OPERATIONS'
      ? (session.admin.regionId ?? '')
      : regionId;
  const load = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      setRows(
        await apiRequest<AdminPayment[]>(
          `/admin/payments${effectiveRegionId ? `?regionId=${effectiveRegionId}` : ''}`,
          {},
          session.accessToken,
        ),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };

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
    load();
  }, [session, effectiveRegionId]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(undefined);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selected]);

  async function refund(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError('');
    try {
      await apiRequest(
        `/admin/payments/${selected.id}/full-refund`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: reason === 'Other' ? customReason : reason,
          }),
        },
        session!.accessToken,
      );
      setSelected(undefined);
      setReason('Customer request');
      setCustomReason('');
      await load();
    } catch (reasonValue) {
      setError((reasonValue as Error).message);
    }
  }

  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="Gateway ledger"
        title="Payments and refunds"
        description="Review payment attempts and issue full refunds with a recorded reason."
      />
      <div className="admin-card mt-5 max-w-sm">
        {session?.admin.role === 'ADMIN' ? (
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
            <div className="text-sm font-semibold">
              {session?.admin.region?.name ?? 'Region not assigned'}
            </div>
          </Field>
        )}
      </div>
      {error && !selected && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}
      <div className="admin-card mt-5 hidden overflow-x-auto p-0 md:block">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Attempt</th>
              <th>Status</th>
              <th>Method</th>
              <th>Refunds</th>
              <th className="text-right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold">
                  {row.order.orderNumber}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {row.order.user.mobileNumber} ·{' '}
                    {row.order.region?.name ?? 'Unassigned'}
                  </span>
                </td>
                <td className="max-w-48 truncate text-xs text-muted-foreground">
                  {row.razorpayPaymentId || row.razorpayOrderId}
                </td>
                <td>
                  <StatusBadge value={row.paymentStatus} />
                  {row.failureReason && (
                    <p className="mt-1 max-w-52 text-xs text-red-600">
                      {row.failureReason}
                    </p>
                  )}
                </td>
                <td>{row.paymentMethod || '—'}</td>
                <td>
                  {row.refunds.length
                    ? row.refunds.map((refund) => (
                        <div key={refund.id} className="mb-1">
                          <StatusBadge value={refund.refundStatus} />{' '}
                          <span className="text-xs">₹{refund.amount}</span>
                        </div>
                      ))
                    : '—'}
                </td>
                <td className="text-right font-semibold">₹{row.amount}</td>
                <td>
                  {row.paymentStatus === 'PAID' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(row);
                      }}
                    >
                      Refund
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <p className="p-10 text-center text-muted-foreground">
            Loading payment attempts…
          </p>
        )}
        {!loading && !rows.length && (
          <p className="p-10 text-center text-muted-foreground">
            No payment attempts were found for this region.
          </p>
        )}
      </div>
      <section
        className="mt-5 grid gap-3 md:hidden"
        aria-label="Payment attempts"
      >
        {rows.map((row) => (
          <article key={row.id} className="admin-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{row.order.orderNumber}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.order.user.mobileNumber} ·{' '}
                  {row.order.region?.name ?? 'Unassigned'}
                </p>
              </div>
              <p className="font-semibold">₹{row.amount}</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <StatusBadge value={row.paymentStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Method</dt>
                <dd className="mt-1 font-medium">{row.paymentMethod || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Payment attempt
                </dt>
                <dd className="mt-1 break-all text-xs">
                  {row.razorpayPaymentId || row.razorpayOrderId || '—'}
                </dd>
              </div>
            </dl>
            {row.failureReason && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {row.failureReason}
              </p>
            )}
            {row.paymentStatus === 'PAID' && (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => setSelected(row)}
              >
                Review refund
              </Button>
            )}
          </article>
        ))}
        {loading && (
          <div className="admin-card py-10 text-center text-muted-foreground">
            Loading payment attempts…
          </div>
        )}
        {!loading && !rows.length && (
          <div className="admin-card py-10 text-center text-muted-foreground">
            No payment attempts were found for this region.
          </div>
        )}
      </section>
      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-title"
        >
          <form
            onSubmit={refund}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="refund-title" className="text-2xl font-semibold">
              Issue refund
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.order.orderNumber} · paid ₹{selected.amount}
            </p>
            <div className="mt-5 space-y-3">
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                This action refunds the full paid amount of ₹{selected.amount}.
                Partial refunds are not supported.
              </p>
              <Field label="Reason">
                <Select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  {refundReasonOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </Select>
              </Field>
              {reason === 'Other' && (
                <Field label="Custom refund reason">
                  <Textarea
                    value={customReason}
                    onChange={(event) => setCustomReason(event.target.value)}
                    placeholder="Custom refund reason"
                    maxLength={500}
                    required
                  />
                </Field>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelected(undefined)}
                >
                  Cancel
                </Button>
                <Button variant="danger" className="flex-1">
                  Confirm full refund
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
