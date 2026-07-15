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
  Clock3,
  CreditCard,
  Leaf,
  LockKeyhole,
  MapPin,
  Pencil,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OrderProgress } from '../../components/order-progress';
import { DataImage } from '../../components/data-image';
import { RetryPaymentButton } from '../../components/retry-payment-button';
import { SelectionContextPanel } from '../../components/selection-context-panel';
import { Button } from '../../components/ui/button';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { formatMenuCalculation } from '../../lib/menu-price-calculation';
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
  quantity: number;
  totalAdjustmentAmount?: string;
};

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
  const [activeCategoryId, setActiveCategoryId] = useState('');

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
      setError(
        nextQuote.valid
          ? ''
          : nextQuote.errors?.join(' ') ||
              'The latest quote could not be completed. Please review your delivery details.',
      );
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
        hydrate(value, session!.user.id);
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
      hydrate(updated, session!.user.id);
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
    if (quote && config.packageType !== 'FIXED_PACKAGE') {
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
          quantity: item.quantity,
          totalAdjustmentAmount: item.totalAdjustmentAmount,
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
          quantity: item.quantity,
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
            quantity: swap?.quantity ?? 1,
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
          quantity: item.quantity,
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

  useEffect(() => {
    if (!groupedRows.length) {
      setActiveCategoryId('');
      return;
    }
    setActiveCategoryId((current) =>
      groupedRows.some((group) => group.id === current)
        ? current
        : groupedRows[0].id,
    );
  }, [groupedRows]);

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
      ? `/packages/build?packageVersionId=${cart.packageVersionId}`
      : '/menu/select';
  const isMealBox = cart.package.type === 'MEAL_BOX';
  const activeGroup =
    groupedRows.find((group) => group.id === activeCategoryId) ??
    groupedRows[0];

  return (
    <main className="bg-background pb-28">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      <section className="relative isolate overflow-hidden bg-primary text-white">
        <img
          src={isMealBox ? '/order-mealbox.png' : '/order-occasion.png'}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.90)_48%,hsl(var(--primary)/0.62)_100%)]" />
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="hidden md:block">
            <OrderProgress
              current={2}
              context={isMealBox ? 'Meal box' : 'Package'}
              inverse
            />
          </div>
          <div className="md:hidden">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              Step 3 of 3
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 md:mt-7">
            <div>
              <p className="eyebrow">Event, review & payment</p>
              <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                Complete your order.
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/82">
                Confirm delivery details, review the full menu, then pay
                securely.
              </p>
            </div>
            {!pendingOrder && (
              <Button
                asChild
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white hover:text-primary"
              >
                <Link href={editHref}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit menu
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {pendingOrder && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Payment is pending.</strong> Your order is safely reserved.
            Retry payment without creating another order.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_392px] lg:items-start">
          <div className="min-w-0 space-y-4">
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

            <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_14px_36px_-30px_rgba(75,12,23,.55)]">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary">
                    <ReceiptText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-serif text-2xl font-semibold">
                      Your menu
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Review and customise your selected dishes.
                    </p>
                  </div>
                </div>
                {!pendingOrder && (
                  <Link
                    href={editHref}
                    className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-bold text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    Change menu
                  </Link>
                )}
              </div>
              {groupedRows.length > 0 ? (
                <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                  <div
                    className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="tablist"
                    aria-label="Menu categories"
                  >
                    {groupedRows.map((group) => {
                      const selected = group.id === activeGroup?.id;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setActiveCategoryId(group.id)}
                          className={cn(
                            'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                            selected
                              ? 'border-primary bg-primary/[0.06] text-primary'
                              : 'border-border bg-[#fcfaf6] text-foreground hover:border-primary/30',
                          )}
                        >
                          {group.name}
                          <span
                            className={cn(
                              'grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]',
                              selected
                                ? 'bg-primary text-white'
                                : 'bg-white text-muted-foreground',
                            )}
                          >
                            {group.rows.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {activeGroup && (
                    <section className="mt-4">
                      <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
                        {activeGroup.name} ({activeGroup.rows.length})
                      </h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {activeGroup.rows.slice(0, 3).map((row) => (
                          <ReviewDishCard key={row.id} row={row} />
                        ))}
                      </div>
                      {activeGroup.rows.length > 3 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer list-none text-center text-sm font-bold text-primary hover:underline">
                            View all dishes
                          </summary>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {activeGroup.rows.slice(3).map((row) => (
                              <ReviewDishCard key={row.id} row={row} />
                            ))}
                          </div>
                        </details>
                      )}
                    </section>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {config
                    ? 'No menu items have been selected yet.'
                    : 'Loading your complete menu...'}
                  {!pendingOrder && (
                    <Link
                      href={editHref}
                      className="mx-auto mt-4 inline-flex min-h-10 items-center rounded-full border border-primary/30 px-4 font-bold text-primary"
                    >
                      Change menu
                    </Link>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_44px_-30px_rgba(75,12,23,.8)]">
              <div className="border-b p-6 pb-4">
                <p className="eyebrow">
                  {pendingOrder ? 'Payment pending' : 'Order summary'}
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold">
                  {cart.package.name}
                </h2>
                {!pendingOrder && <OrderFacts cart={cart} quote={quote} />}
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
                    <PriceSummary
                      quote={quote}
                      unitLabel={
                        cart.package.type === 'MEAL_BOX' ? 'box' : 'person'
                      }
                    />
                  ) : (
                    <div className="rounded-xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                      {quoteLoading
                        ? 'Refreshing your final quote…'
                        : 'Confirm the delivery time and venue to calculate the final total.'}
                    </div>
                  )}
                  <div className="mt-5 rounded-xl border border-amber-200/80 bg-[#fff8ea] p-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <LockKeyhole className="h-4 w-4 text-primary" />
                      Safe & secure payments
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Your payment details are handled securely.
                    </p>
                  </div>
                  <Button
                    className="mt-4 h-12 w-full"
                    onClick={pay}
                    disabled={!ready || !quote?.valid || quoteLoading || paying}
                  >
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    {paying ? 'Opening payment...' : 'Proceed to Payment'}
                  </Button>
                  <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    {ready
                      ? 'You will be redirected to our secure payment partner.'
                      : 'Venue, date, time, and guest count are required.'}
                  </p>
                  {error && (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800"
                    >
                      {error}
                    </p>
                  )}
                </div>
              )}
            </section>
          </aside>
        </div>

        <TrustStrip />
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

function formatCartDate(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function EventSummary({ cart }: { cart: CartSummary }) {
  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6">
      <p className="eyebrow">Delivery details</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Info
          icon={CalendarDays}
          label="When"
          value={
            cart.event
              ? `${cart.event.eventDate} at ${cart.event.eventTimeStart || ''}`
              : 'Not set'
          }
        />
        <Info
          icon={Users}
          label={cart.package.type === 'MEAL_BOX' ? 'Boxes' : 'Guests'}
          value={String(cart.event?.guestCount ?? cart.guestCount ?? 'Not set')}
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

function ReviewDishCard({ row }: { row: ReviewRow }) {
  const state =
    row.role === 'SWAP'
      ? 'Swapped'
      : row.role === 'EXTRA'
        ? 'Extra'
        : row.role === 'CUSTOM'
          ? 'Selected'
          : 'Included';
  const adjustment = Number(row.adjustmentAmount);
  return (
    <article className="grid min-h-[104px] grid-cols-[84px_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-[#fffdfa] p-2.5 transition hover:border-primary/25">
      <span className="h-full min-h-[84px] overflow-hidden rounded-lg bg-muted">
        <DataImage
          src={row.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
      <span className="flex min-w-0 flex-col justify-between py-1">
        <span className="min-w-0">
          <strong className="block truncate text-sm font-bold text-foreground">
            {row.name}
          </strong>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Leaf className="h-3 w-3" /> {row.isVeg ? 'Veg' : 'Non-veg'}
            </span>
            {row.role !== 'CUSTOM' && adjustment > 0 && (
              <span>{formatCurrency(adjustment)} / plate</span>
            )}
          </span>
          {row.replacedName && (
            <span className="mt-1 block truncate text-[11px] text-muted-foreground">
              Replaces {row.replacedName}
            </span>
          )}
          {row.role === 'EXTRA' && (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {row.quantity} portion{row.quantity === 1 ? '' : 's'}
            </span>
          )}
        </span>
        <span
          className={cn(
            'mt-2 inline-flex w-fit items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold',
            row.role === 'SWAP' &&
              'border-emerald-200 bg-emerald-50 text-emerald-700',
            row.role === 'EXTRA' && 'border-rose-200 bg-rose-50 text-primary',
            row.role === 'CUSTOM' &&
              'border-primary/20 bg-primary/5 text-primary',
            row.role === 'INCLUDED' &&
              'border-amber-200 bg-amber-50 text-amber-700',
          )}
        >
          <CheckCircle2 className="h-3 w-3" />
          {state}
          {Number(row.adjustmentAmount) > 0 &&
            ` · +${formatCurrency(
              row.totalAdjustmentAmount ??
                (row.role === 'EXTRA'
                  ? Number(row.adjustmentAmount) * row.quantity
                  : Number(row.adjustmentAmount)),
            )}`}
        </span>
      </span>
    </article>
  );
}

function OrderFacts({
  cart,
  quote,
}: {
  cart: CartSummary;
  quote?: PackageSelectionPrice;
}) {
  const address = cart.event?.address;
  const facts = [
    ['Package', cart.package.name],
    [
      cart.package.type === 'MEAL_BOX' ? 'Boxes' : 'Guests',
      String(
        quote?.guestCount ??
          cart.event?.guestCount ??
          cart.guestCount ??
          'Not set',
      ),
    ],
    ['Delivery date', formatCartDate(cart.event?.eventDate)],
    ['Delivery time', cart.event?.eventTimeStart || 'Not set'],
    [
      'Delivery venue',
      address
        ? `${address.label || address.addressLine1}, ${address.city}`
        : 'Not set',
    ],
  ];

  return (
    <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
      {facts.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="max-w-[58%] text-right font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TrustStrip() {
  const items = [
    {
      icon: ShieldCheck,
      title: 'Hygienic & Safe',
      body: 'Prepared with quality ingredients',
    },
    {
      icon: Clock3,
      title: 'On-time Delivery',
      body: 'Planned around your serving time',
    },
    {
      icon: CheckCircle2,
      title: 'Trusted catering service',
      body: 'Support from enquiry to delivery',
    },
    {
      icon: CreditCard,
      title: 'Transparent Pricing',
      body: 'Review the complete quote before payment',
    },
  ];

  return (
    <section className="mt-6 grid gap-0 overflow-hidden rounded-2xl border border-border bg-[#fff8ea] sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, body }, index) => (
        <div
          key={title}
          className={cn(
            'flex items-center gap-3 p-4',
            index > 0 && 'border-t sm:border-l sm:border-t-0',
            index === 2 && 'sm:border-t lg:border-t-0',
          )}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <strong className="block text-sm">{title}</strong>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {body}
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}

function PriceSummary({
  quote,
  unitLabel,
}: {
  quote: PackageSelectionPrice;
  unitLabel: 'box' | 'person';
}) {
  const menuCalculation = formatMenuCalculation({
    basePrice: quote.basePerPlatePrice,
    guestCount: quote.guestCount,
    unitLabel: unitLabel === 'box' ? 'box' : 'guest',
    items: quote.items,
  });
  return (
    <>
      <div className="space-y-3 text-sm">
        <PriceLine label="Menu calculation" value={menuCalculation} />
        <PriceLine
          label="Menu subtotal"
          value={formatCurrency(quote.subtotalAmount)}
        />
        <div className="rounded-xl bg-muted/50 p-3">
          <PriceLine
            label="Delivery"
            value={formatCurrency(quote.deliveryFee)}
          />
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
        <strong className="font-serif text-4xl">
          {formatCurrency(quote.totalAmount)}
        </strong>
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
