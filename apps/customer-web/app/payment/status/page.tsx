'use client';

import type { OrderSummary } from '@aranyam/shared-types';
import { CheckCircle, Clock3, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { apiRequest } from '../../../lib/api';
import { useSessionStore } from '../../../store/session.store';

export default function PaymentStatusPage() {
  const session = useSessionStore((state) => state.session);
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<OrderSummary>();
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    const nextOrderId =
      new URLSearchParams(window.location.search).get('orderId') ?? '';
    setOrderId(nextOrderId);
    if (!nextOrderId) setLoadError('This payment link is missing an order ID.');
  }, []);
  useEffect(() => {
    if (!session || !orderId) return;
    let active = true;
    let attempts = 0;
    const check = async () => {
      try {
        const next = await apiRequest<OrderSummary>(
          `/orders/${orderId}`,
          {},
          session.accessToken,
        );
        if (!active) return;
        setOrder(next);
        setLoadError('');
        attempts += 1;
        if (next.paymentStatus === 'PENDING' && attempts < 10)
          window.setTimeout(check, 2000);
      } catch (error) {
        if (active) setLoadError((error as Error).message);
      }
    };
    check();
    return () => {
      active = false;
    };
  }, [session, orderId]);
  const paid = order?.paymentStatus === 'PAID';
  const failed = order?.paymentStatus === 'FAILED' || Boolean(loadError);
  const Icon = paid ? CheckCircle : failed ? XCircle : Clock3;
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center">
      <Icon
        className={`h-12 w-12 ${paid ? 'text-primary' : failed ? 'text-red-600' : 'text-amber-600'}`}
      />
      <h1 className="mt-5 text-3xl font-semibold">
        {paid
          ? 'Payment confirmed'
          : failed
            ? 'Payment failed'
            : 'Confirming payment'}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {paid
          ? 'Your order is confirmed.'
          : failed
            ? loadError || 'Your order is saved and payment can be retried.'
            : 'We are waiting for secure confirmation from Razorpay. This can take a few moments.'}
      </p>
      <div className="mt-8 flex gap-3">
        {orderId && (
          <Button asChild>
            <Link href={`/orders/${orderId}`}>View order</Link>
          </Button>
        )}
        {failed && (
          <Button asChild variant="outline">
            <Link href="/cart">Retry payment</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
