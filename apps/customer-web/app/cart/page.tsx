'use client';

import type {
  CartSummary,
  GatewayOrder,
  OrderSummary,
  PackageConfiguration,
  PackageSelectionPrice,
} from '@aranyam/shared-types';
import {
  CalendarDays,
  CheckCircle2,
  Leaf,
  LockKeyhole,
  MapPin,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OrderProgress } from '../../components/order-progress';
import { RetryPaymentButton } from '../../components/retry-payment-button';
import { SelectionContextPanel } from '../../components/selection-context-panel';
import { Button } from '../../components/ui/button';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { cn } from '../../lib/utils';
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

type ReviewRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  imageUrl?: string | null;
  isVeg: boolean;
  role: 'INCLUDED' | 'SWAP' | 'EXTRA' | 'CUSTOM';
  replacedName?: string | null;
  adjustmentAmount: string;
};

const fallbackFoodImages = [
  '/tray-3.png',
  '/tray-5.png',
  '/tray-8.png',
  '/order-mealbox.png',
  '/order-build.png',
  '/order-occasion.png',
];

function reviewImage(row: Pick<ReviewRow, 'id' | 'imageUrl'>) {
  if (row.imageUrl) return row.imageUrl;
  const index = [...row.id].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return fallbackFoodImages[index % fallbackFoodImages.length];
}

export default function CartPage() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const hydrate = useOrderBuilderStore((state) => state.hydrateFromCart);
  const reset = useOrderBuilderStore((state) => state.reset);
  const pendingOrderId = useOrderBuilderStore((state) => state.pendingOrderId);
  const setPendingOrderId = useOrderBuilderStore(
    (state) => state.setPendingOrderId,
  );

  const [cart, setCart] = useState<CartSummary>();
  const [config, setConfig] = useState<PackageConfiguration>();
  const [quote, setQuote] = useState<PackageSelectionPrice>();
  const [pendingOrder, setPendingOrder] = useState<OrderSummary>();
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const loadQuote = useCallback(async () => {
    if (!session) return;
    setQuoteLoading(true);
    try {
      const nextQuote = await apiRequest<PackageSelectionPrice>(
        '/cart/quote',
        { method: 'POST' },
        session.accessToken,
      );
      setQuote(nextQuote);
      setError(nextQuote.valid ? '' : nextQuote.errors.join(' '));
    } catch (reason) {
      setQuote(undefined);
      setError((reason as Error).message);
    } finally {
      setQuoteLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    async function load() {
      try {
        const value = await apiRequest<CartSummary | null>(
          '/cart',
          {},
          session!.accessToken,
        );
        if (!active || !value) return;
        setCart(value);
        hydrate(value);
        const configuration = await apiRequest<PackageConfiguration>(
          `/package-versions/${value.packageVersionId}/configuration`,
        );
        if (!active) return;
        setConfig(configuration);
        if (value.pendingOrderId) {
          const order = await apiRequest<OrderSummary>(
            `/orders/${value.pendingOrderId}`,
            {},
            session!.accessToken,
          );
          if (active) setPendingOrder(order);
        } else if (eventReady(value)) {
          await loadQuote();
        }
      } catch (reason) {
        if (active) setError((reason as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [session, hydrate, loadQuote]);

  const onEventSaved = useCallback(
    (updated: CartSummary) => {
      setCart(updated);
      hydrate(updated);
      if (eventReady(updated)) void loadQuote();
    },
    [hydrate, loadQuote],
  );

  const configItems = useMemo(() => {
    const entries =
      config?.categoryRules.flatMap((rule) =>
        rule.items.map((item) => [item.id, item] as const),
      ) ?? [];
    return new Map(entries);
  }, [config]);

  const reviewRows = useMemo<ReviewRow[]>(() => {
    if (!cart || !config) return [];
    if (quote) {
      return quote.items.map((item) => {
        const configured = configItems.get(item.menuItemId);
        return {
          id: `${item.categoryId}-${item.menuItemId}-${item.replacedMenuItemId ?? ''}`,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          name: item.menuItemName,
          imageUrl: configured?.imageUrl,
          isVeg: configured?.isVeg ?? true,
          role: item.role ?? 'INCLUDED',
          replacedName: item.replacedMenuItemName,
          adjustmentAmount: item.adjustmentAmount,
        };
      });
    }

    if (config.packageType === 'CUSTOM_PACKAGE') {
      return cart.items.map((item) => {
        const configured = configItems.get(item.menuItemId);
        return {
          id: item.id,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          name: item.menuItemName,
          imageUrl: configured?.imageUrl,
          isVeg: item.isVeg,
          role: 'CUSTOM',
          adjustmentAmount: configured?.adjustmentAmount ?? '0.00',
        };
      });
    }

    const modifications = new Map(
      cart.items
        .filter((item) => item.replacedMenuItemId)
        .map((item) => [item.replacedMenuItemId!, item]),
    );
    const included = config.categoryRules.flatMap((rule) =>
      rule.items
        .filter((item) => item.role === 'INCLUDED' && !item.swapForMenuItemId)
        .map((item) => {
          const swap = modifications.get(item.id);
          const shown = swap
            ? (configItems.get(swap.menuItemId) ?? item)
            : item;
          return {
            id: `${rule.id}-${item.id}`,
            categoryId: rule.category.id,
            categoryName: rule.category.name,
            name: shown.name,
            imageUrl: shown.imageUrl,
            isVeg: shown.isVeg,
            role: swap ? ('SWAP' as const) : ('INCLUDED' as const),
            replacedName: swap ? item.name : undefined,
            adjustmentAmount: shown.adjustmentAmount,
          };
        }),
    );
    const extras = cart.items
      .filter((item) => item.role === 'EXTRA')
      .map((item) => {
        const configured = configItems.get(item.menuItemId);
        return {
          id: item.id,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          name: item.menuItemName,
          imageUrl: configured?.imageUrl,
          isVeg: item.isVeg,
          role: 'EXTRA' as const,
          adjustmentAmount: configured?.adjustmentAmount ?? '0.00',
        };
      });
    return [...included, ...extras];
  }, [cart, config, configItems, quote]);

  const groupedRows = useMemo(
    () =>
      reviewRows.reduce<Array<{ id: string; name: string; rows: ReviewRow[] }>>(
        (groups, row) => {
          const group = groups.find((entry) => entry.id === row.categoryId);
          if (group) group.rows.push(row);
          else
            groups.push({
              id: row.categoryId,
              name: row.categoryName,
              rows: [row],
            });
          return groups;
        },
        [],
      ),
    [reviewRows],
  );

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
    if (!session || !cart || !quote || !eventReady(cart)) return;
    setError('');
    setPaying(true);
    try {
      const order = pendingOrderId
        ? await apiRequest<OrderSummary>(
            `/orders/${pendingOrderId}`,
            {},
            session.accessToken,
          )
        : await apiRequest<OrderSummary>(
            '/cart/checkout',
            { method: 'POST' },
            session.accessToken,
          );
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
      if (!window.Razorpay) {
        throw new Error(
          'Secure payment is still loading. Please try again in a moment.',
        );
      }
      const checkout = new window.Razorpay({
        key: gateway.keyId,
        amount: gateway.amount,
        currency: gateway.currency,
        name: 'The Feast Factory',
        description: `${cart.package.name} for ${quote.guestCount} guests`,
        order_id: gateway.id,
        prefill: {
          name: session.user.name ?? '',
          email: session.user.email ?? '',
          contact: session.user.mobileNumber,
        },
        theme: { color: '#7c1d2c' },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setError(
              'Payment window closed. Your order is saved and you can retry safely.',
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
        title="Sign in to resume your order"
        description="Your menu is saved on this device. Sign in to add event details and continue to payment."
        returnHref="/cart"
      />
    );
  }
  if (loading) {
    return (
      <main className="page-shell">
        <div className="h-80 animate-pulse rounded-2xl bg-white/60" />
      </main>
    );
  }
  if (!cart) {
    return (
      <main className="page-shell">
        <StatePanel
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Choose a meal box or package to begin."
          actionHref="/packages"
          actionLabel="Browse packages"
        />
      </main>
    );
  }

  const ready = eventReady(cart);
  const editHref =
    cart.package.type === 'CUSTOM_PACKAGE'
      ? '/menu/visual-builder'
      : '/menu/select';
  const isMealBox = cart.package.type === 'MEAL_BOX';

  return (
    <main className="page-shell pb-28">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      <OrderProgress current={2} context={isMealBox ? 'Meal box' : 'Package'} />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Event, review & payment</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
            Complete your order.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add event details, review the full menu, then pay securely.
          </p>
        </div>
        {!pendingOrder && (
          <Button asChild variant="outline">
            <Link href={editHref}>
              <Pencil className="mr-2 h-4 w-4" /> Edit menu
            </Link>
          </Button>
        )}
      </div>

      {pendingOrder && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Payment is pending.</strong> Your order is safely reserved.
          Retry payment without creating another order.
        </div>
      )}

      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_370px]">
        <div className="min-w-0 space-y-6">
          {pendingOrder ? (
            <EventSummary cart={cart} />
          ) : (
            <SelectionContextPanel
              packageVersionId={cart.packageVersionId}
              minPax={cart.package.minGuestCount}
              maxPax={cart.package.maxGuestCount}
              onSaved={onEventSaved}
            />
          )}

          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-[#fcfaf6] p-5 sm:p-6">
              <div>
                <p className="eyebrow">Your menu</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  {cart.package.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reviewRows.length} dishes ·{' '}
                  {isMealBox ? 'complete meal box' : 'complete order menu'}
                </p>
              </div>
              {!pendingOrder && (
                <Link
                  href={editHref}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Change menu
                </Link>
              )}
            </div>
            {groupedRows.length > 0 ? (
              <div className="p-5 sm:p-6">
                {groupedRows.map((group, groupIndex) => (
                  <section
                    key={group.id}
                    className={cn(groupIndex > 0 && 'mt-6')}
                  >
                    <h3 className="border-b pb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
                      {group.name} · {group.rows.length}
                    </h3>
                    <div className="divide-y">
                      {group.rows.map((row) => (
                        <ReviewDishRow key={row.id} row={row} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {config
                  ? 'No menu items have been selected yet.'
                  : 'Loading your complete menu…'}
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit lg:sticky lg:top-24">
          <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_16px_38px_-30px_rgba(75,12,23,.7)]">
            <div className="border-b p-6">
              <p className="eyebrow">
                {pendingOrder ? 'Payment pending' : 'Order summary'}
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold">
                {cart.package.name}
              </h2>
            </div>
            {pendingOrder ? (
              <div className="p-6">
                <div className="flex items-end justify-between border-b pb-5">
                  <span className="font-semibold">Total</span>
                  <strong className="font-serif text-3xl">
                    ₹{pendingOrder.totalAmount}
                  </strong>
                </div>
                <div className="mt-5">
                  <RetryPaymentButton order={pendingOrder} />
                </div>
                <Button asChild variant="outline" className="mt-3 w-full">
                  <Link href={`/orders/${pendingOrder.id}`}>
                    View saved order
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="p-6">
                {quote ? (
                  <PriceSummary quote={quote} />
                ) : (
                  <div className="rounded-xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                    {quoteLoading
                      ? 'Refreshing your final quote…'
                      : 'Complete event and venue details to calculate delivery and the final total.'}
                  </div>
                )}
                <Button
                  className="mt-6 w-full"
                  onClick={pay}
                  disabled={!ready || !quote?.valid || quoteLoading || paying}
                >
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  {paying ? 'Opening payment…' : 'Pay securely'}
                </Button>
                {!ready && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Event date, time, venue, and guest count are required.
                  </p>
                )}
                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800"
                  >
                    {error}
                  </p>
                )}
                <div className="mt-6 space-y-3 border-t pt-5 text-xs text-muted-foreground">
                  <p className="flex gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    Payment details are handled securely by Razorpay.
                  </p>
                  <p className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    Your order is confirmed after payment verification.
                  </p>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function eventReady(cart: CartSummary) {
  return Boolean(
    cart.event?.address &&
    cart.event.eventDate &&
    cart.event.eventTimeStart &&
    cart.event.guestCount,
  );
}

function EventSummary({ cart }: { cart: CartSummary }) {
  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6">
      <p className="eyebrow">Event and venue</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Info
          icon={CalendarDays}
          label="Event"
          value={
            cart.event
              ? `${cart.event.eventName || cart.package.name} · ${cart.event.eventDate} ${cart.event.eventTimeStart || ''}`
              : 'Not set'
          }
        />
        <Info
          icon={Users}
          label={cart.package.type === 'MEAL_BOX' ? 'Boxes' : 'Guests'}
          value={String(cart.event?.guestCount ?? 'Not set')}
        />
        <Info
          icon={MapPin}
          label="Venue"
          value={
            cart.event?.address
              ? `${cart.event.address.label || cart.event.address.addressLine1}, ${cart.event.address.city}`
              : 'Not set'
          }
        />
      </div>
    </section>
  );
}

function ReviewDishRow({ row }: { row: ReviewRow }) {
  const state =
    row.role === 'SWAP'
      ? 'Swapped'
      : row.role === 'EXTRA'
        ? 'Extra'
        : row.role === 'CUSTOM'
          ? 'Selected'
          : 'Included';
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 py-3">
      <span className="h-14 overflow-hidden rounded-lg bg-muted">
        <img
          src={reviewImage(row)}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
      <span className="min-w-0">
        <strong className="block truncate font-serif text-lg">
          {row.name}
        </strong>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Leaf className="h-3 w-3" /> {row.isVeg ? 'Veg' : 'Non-veg'}
          </span>
          {row.replacedName && <span>replaces {row.replacedName}</span>}
        </span>
      </span>
      <span
        className={cn(
          'rounded-lg border px-2.5 py-1 text-[10px] font-bold',
          row.role === 'SWAP' &&
            'border-emerald-200 bg-emerald-50 text-emerald-700',
          row.role === 'EXTRA' && 'border-rose-200 bg-rose-50 text-primary',
          row.role === 'CUSTOM' &&
            'border-primary/20 bg-primary/5 text-primary',
          row.role === 'INCLUDED' &&
            'border-amber-200 bg-amber-50 text-amber-700',
        )}
      >
        {state}
        {Number(row.adjustmentAmount) > 0 && ` · +₹${row.adjustmentAmount}`}
      </span>
    </div>
  );
}

function PriceSummary({ quote }: { quote: PackageSelectionPrice }) {
  return (
    <>
      <div className="space-y-3 text-sm">
        <PriceLine label="Per person" value={`₹${quote.finalPerPlatePrice}`} />
        {Number(quote.totalCustomizationCharges) > 0 && (
          <PriceLine
            label="Menu additions"
            value={`₹${quote.totalCustomizationCharges}`}
          />
        )}
        <PriceLine label="Menu subtotal" value={`₹${quote.subtotalAmount}`} />
        <div className="rounded-xl bg-muted/50 p-3">
          <PriceLine label="Delivery" value={`₹${quote.deliveryFee}`} />
          {quote.region && (
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {quote.region.name} kitchen · {quote.distanceKm} km
            </p>
          )}
        </div>
      </div>
      <div className="my-5 h-px bg-border" />
      <div className="flex items-end justify-between gap-4">
        <span className="font-semibold">Total</span>
        <strong className="font-serif text-4xl">₹{quote.totalAmount}</strong>
      </div>
    </>
  );
}

function PriceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm leading-6">{value}</p>
      </div>
    </div>
  );
}
