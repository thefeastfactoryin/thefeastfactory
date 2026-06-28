'use client';

import { CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { GatewayOrder, OrderSummary, PackageSelectionPrice } from '@aranyam/shared-types';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OrderProgress } from '../../components/order-progress';
import { Button } from '../../components/ui/button';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { useSessionStore } from '../../store/session.store';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (
        event: string,
        handler: (response: { error?: { description?: string } }) => void,
      ) => void;
    };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const event = useOrderBuilderStore((state) => state.event);
  const cartPackage = useOrderBuilderStore((state) => state.package);
  const selectedItems = useOrderBuilderStore((state) => state.selectedItems);
  const reset = useOrderBuilderStore((state) => state.reset);
  const pendingOrderId = useOrderBuilderStore((state) => state.pendingOrderId);
  const setPendingOrderId = useOrderBuilderStore((state) => state.setPendingOrderId);
  const [quote, setQuote] = useState<PackageSelectionPrice>();
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const hasMenuSelection =
    cartPackage?.packageType === 'MEAL_BOX' ||
    cartPackage?.packageType === 'FIXED_PACKAGE' ||
    selectedItems.length > 0;

  useEffect(() => {
    if (!session || !event || !cartPackage || !hasMenuSelection)
      return;
    setError('');
    apiRequest<PackageSelectionPrice>(
      '/cart/quote',
      { method: 'POST' },
      session.accessToken,
    )
      .then(setQuote)
      .catch((reason) => setError(reason.message));
  }, [session, event, cartPackage, selectedItems, hasMenuSelection]);

  async function verifyPayment(
    orderId: string,
    response: Record<string, string>,
  ) {
    await apiRequest(
      '/payments/razorpay/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      },
      session!.accessToken,
    );
    reset();
    router.push(`/payment/status?orderId=${orderId}&status=success`);
  }

  async function pay() {
    if (!session || !event || !quote) return;
    setError('');
    setPaying(true);
    try {
      const order = pendingOrderId
        ? await apiRequest<OrderSummary>(`/orders/${pendingOrderId}`, {}, session.accessToken)
        : await apiRequest<OrderSummary>('/cart/checkout', { method: 'POST' }, session.accessToken);
      setPendingOrderId(order.id);
      const gateway = await apiRequest<GatewayOrder>(
        `/orders/${order.id}/payments/razorpay-order`,
        { method: 'POST' },
        session.accessToken,
      );

      if (gateway.localMode) {
        await verifyPayment(order.id, {
          razorpay_order_id: gateway.id,
          razorpay_payment_id: `local_payment_${Date.now()}`,
          razorpay_signature: 'local_success',
        });
        return;
      }

      if (!window.Razorpay)
        throw new Error(
          'Secure payment window is still loading. Please try again.',
        );
      const checkout = new window.Razorpay({
        key: gateway.keyId,
        amount: gateway.amount,
        currency: gateway.currency,
        name: 'The Feast Factory',
        description: `${cartPackage?.packageName ?? 'Catering'} for ${quote.guestCount} guests`,
        order_id: gateway.id,
        prefill: {
          name: session.user.name ?? '',
          email: session.user.email ?? '',
          contact: session.user.mobileNumber,
        },
        theme: { color: '#1b513a' },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setError(
              'Payment window closed. Your order is still saved and you can retry safely.',
            );
            setPaying(false);
          },
        },
        handler: async (response: Record<string, string>) => {
          try {
            await verifyPayment(order.id, response);
          } catch (reason) {
            setError((reason as Error).message);
            setPaying(false);
          }
        },
      });
      checkout.on('payment.failed', (response) => {
        setError(
          response?.error?.description ||
            'Payment failed. You can retry without creating another order.',
        );
        setPaying(false);
      });
      checkout.open();
    } catch (reason) {
      setError((reason as Error).message);
      setPaying(false);
    }
  }

  if (!session) {
    return (
      <AuthRequiredPanel
        title="Sign in to place your order"
        description="Your cart is saved on this device. Sign in to attach the order to your mobile number and unlock secure payment."
        returnHref="/checkout"
      />
    );
  }

  if (!event || !cartPackage || !hasMenuSelection) {
    return (
      <main className="page-shell">
        <StatePanel
          icon={CheckCircle2}
          eyebrow="Checkout checklist"
          title="Your order needs a little more detail"
          description="Complete the package, event details, and menu selection before opening secure payment."
          actionHref="/cart"
          actionLabel="Return to cart"
          secondaryHref="/packages"
          secondaryLabel="Browse packages"
        />
      </main>
    );
  }

  return (
    <main className="page-shell pb-28">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      <OrderProgress current={3} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <section>
          <p className="eyebrow">Secure checkout</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">
            One final review.
          </h1>
          <p className="mt-3 text-muted-foreground">
            {cartPackage.isCustom
              ? 'Your quote is calculated from selected item prices and saved as an order snapshot.'
              : 'Your quote is calculated from the live package rules and saved as an order snapshot.'}
          </p>

          {quote ? (
            <div className="surface-card mt-8 overflow-hidden">
              <div className="border-b bg-white/60 p-6">
                <h2 className="font-serif text-2xl font-semibold">
                  {quote.packageName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {quote.guestCount} guests · {event.addressLabel}
                </p>
              </div>
              <div className="divide-y">
                {quote.items.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div>
                      <p className="font-semibold">{item.menuItemName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.categoryName}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {cartPackage.isCustom
                        ? `₹${item.itemPrice}`
                        : Number(item.adjustmentAmount)
                          ? `+₹${item.adjustmentAmount}`
                          : 'Included'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-8 h-80 animate-pulse rounded-xl bg-white/60" />
          )}
        </section>

        <aside className="surface-card h-fit p-7 lg:sticky lg:top-28">
          <p className="eyebrow">Payment summary</p>
          {quote && (
            <>
              <div className="mt-6 space-y-3 text-sm">
                {!cartPackage.isCustom && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Base per plate
                    </span>
                    <span>₹{quote.basePerPlatePrice}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {cartPackage.isCustom
                      ? 'Selected item total per plate'
                      : 'Premium additions'}
                  </span>
                  <span>₹{quote.totalCustomizationCharges}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Final per plate</span>
                  <span>₹{quote.finalPerPlatePrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Menu subtotal</span>
                  <span>₹{quote.subtotalAmount}</span>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <div className="flex justify-between font-medium">
                    <span>Delivery fee</span>
                    <span>₹{quote.deliveryFee}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {quote.region?.name} kitchen · {quote.distanceKm} km ·
                    billed {quote.billableDistanceKm} km at ₹
                    {quote.deliveryFeePerKm}/km
                  </p>
                </div>
              </div>
              <div className="my-5 h-px bg-border" />
              <div className="flex items-end justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-serif text-4xl font-semibold">
                  ₹{quote.totalAmount}
                </span>
              </div>
              <Button className="mt-7 w-full" onClick={pay} disabled={paying}>
                <LockKeyhole className="mr-2 h-4 w-4" />{' '}
                {paying ? 'Opening payment…' : 'Pay securely'}
              </Button>
            </>
          )}
          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-800"
            >
              {error}
            </div>
          )}
          <div className="mt-6 space-y-3 border-t pt-5 text-xs text-muted-foreground">
            <p className="flex gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> Payment
              details are handled securely by Razorpay.
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Your
              order is confirmed only after payment verification.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
