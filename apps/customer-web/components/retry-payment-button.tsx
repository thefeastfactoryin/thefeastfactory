'use client';

import type { GatewayOrder, OrderSummary } from '@aranyam/shared-types';
import Script from 'next/script';
import { useState } from 'react';
import { apiRequest } from '../lib/api';
import { useSessionStore } from '../store/session.store';
import { Button } from './ui/button';

export function RetryPaymentButton({
  order,
  orderIds,
}: {
  order: OrderSummary;
  orderIds?: string[];
}) {
  const session = useSessionStore((s) => s.session);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function verify(gateway: GatewayOrder, paymentId: string, signature: string) {
    await apiRequest('/payments/razorpay/verify', { method: 'POST', body: JSON.stringify({ razorpayOrderId: gateway.id, razorpayPaymentId: paymentId, razorpaySignature: signature }) }, session!.accessToken);
    window.location.assign(`/payment/status?orderId=${order.id}&status=success`);
  }
  async function retry() {
    if (!session) return;
    setBusy(true); setError('');
    try {
      const batchIds = [...new Set(orderIds ?? [order.id])];
      const gateway =
        batchIds.length > 1
          ? await apiRequest<GatewayOrder>(
              '/payments/razorpay/batch-order',
              {
                method: 'POST',
                body: JSON.stringify({ orderIds: batchIds }),
              },
              session.accessToken,
            )
          : await apiRequest<GatewayOrder>(
              `/orders/${order.id}/payments/razorpay-order`,
              { method: 'POST' },
              session.accessToken,
            );
      if (gateway.localMode) return void await verify(gateway, `local_payment_${Date.now()}`, 'local_success');
      if (!window.Razorpay) throw new Error('Secure payment window is still loading.');
      const checkout = new window.Razorpay({ key: gateway.keyId, amount: gateway.amount, currency: gateway.currency, name: 'The Feast Factory', description: order.packageName, order_id: gateway.id, handler: async (response: Record<string,string>) => verify(gateway, response.razorpay_payment_id, response.razorpay_signature), modal: { ondismiss: () => { setError('Payment window closed. You can retry safely.'); setBusy(false); } } });
      checkout.on('payment.failed', (response) => { setError(response?.error?.description || 'Payment failed. You can retry safely.'); setBusy(false); });
      checkout.open();
    } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  return <><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" /><Button onClick={retry} disabled={busy}>{busy ? 'Opening payment…' : 'Retry payment'}</Button>{error && <p className="mt-2 text-sm text-red-700">{error}</p>}</>;
}
