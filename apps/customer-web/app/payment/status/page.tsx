'use client';

import type { BookingSummary, OrderSummary } from '@aranyam/shared-types';
import { CheckCircle, Clock3, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { apiRequest } from '../../../lib/api';
import { useSessionStore } from '../../../store/session.store';
import {
  AuthRequiredPanel,
  StatePanel,
} from '../../../components/ui/state-panel';

export default function PaymentStatusPage() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const [orderId, setOrderId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [record, setRecord] = useState<OrderSummary | BookingSummary>();
  const [loadError, setLoadError] = useState('');
  const [confirmationDelayed, setConfirmationDelayed] = useState(false);
  useEffect(() => {
    const nextOrderId =
      new URLSearchParams(window.location.search).get('orderId') ?? '';
    const nextBookingId =
      new URLSearchParams(window.location.search).get('bookingId') ?? '';
    setOrderId(nextOrderId);
    setBookingId(nextBookingId);
    if (!nextOrderId && !nextBookingId)
      setLoadError('This payment link is missing a booking ID.');
  }, []);
  useEffect(() => {
    if (!session || (!orderId && !bookingId)) return;
    let active = true;
    let attempts = 0;
    let timer: number | undefined;
    const check = async () => {
      if (!active) return;
      try {
        const next = await apiRequest<OrderSummary | BookingSummary>(
          bookingId ? `/bookings/${bookingId}` : `/orders/${orderId}`,
          {},
          session.accessToken,
        );
        if (!active) return;
        if (next.paymentStatus === 'FAILED') {
          router.replace(
            bookingId
              ? `/bookings/${bookingId}?payment=failed`
              : `/cart?payment=failed&orderId=${orderId}`,
          );
          return;
        }
        setRecord(next);
        setLoadError('');
        attempts += 1;
        if (next.paymentStatus === 'PENDING' && attempts < 10) {
          timer = window.setTimeout(check, 2000);
        } else if (next.paymentStatus === 'PENDING') {
          setConfirmationDelayed(true);
        }
      } catch (error) {
        if (active) setLoadError((error as Error).message);
      }
    };
    check();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [session, orderId, bookingId, router]);
  const paymentReceived =
    record?.paymentStatus === 'PAID' ||
    record?.paymentStatus === 'PARTIALLY_PAID';
  const checkFailed = Boolean(loadError);
  const Icon = paymentReceived ? CheckCircle : checkFailed ? XCircle : Clock3;
  if (!session)
    return (
      <AuthRequiredPanel
        title="Sign in to check payment status"
        description="Payment confirmation is linked to the verified customer account."
        returnHref={
          bookingId
            ? `/payment/status?bookingId=${bookingId}`
            : orderId
              ? `/payment/status?orderId=${orderId}`
              : '/orders'
        }
      />
    );
  if (!orderId && !bookingId && loadError)
    return (
      <main className="page-shell">
        <StatePanel
          tone="danger"
          title="Payment link is incomplete"
          description={loadError}
          actionHref="/bookings"
          actionLabel="View orders"
        />
      </main>
    );
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center">
      <Icon
        className={`h-12 w-12 ${paymentReceived ? 'text-primary' : checkFailed ? 'text-red-600' : 'text-amber-600'}`}
      />
      <h1 className="mt-5 text-3xl font-semibold">
        {paymentReceived
          ? record?.paymentStatus === 'PARTIALLY_PAID'
            ? 'Deposit received'
            : 'Payment received'
          : checkFailed
            ? 'Could not check payment'
            : confirmationDelayed
              ? 'Confirmation is taking longer'
              : 'Confirming payment'}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {paymentReceived
          ? 'Your booking request is awaiting kitchen approval. We will show the kitchen’s decision in your order details.'
          : checkFailed
            ? loadError
            : confirmationDelayed
              ? 'Your order is safe. Check its status again shortly.'
              : 'We are waiting for secure confirmation from Razorpay. This can take a few moments.'}
      </p>
      <div className="mt-8 flex gap-3">
        {(bookingId || orderId) && (
          <Button asChild>
            <Link
              href={bookingId ? `/bookings/${bookingId}` : `/orders/${orderId}`}
            >
              View booking
            </Link>
          </Button>
        )}
        {checkFailed && (
          <Button asChild variant="outline">
            <Link href="/cart">Back to cart</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
