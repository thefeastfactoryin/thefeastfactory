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
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Trash2,
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

type MultiCartQuote = {
  valid: boolean;
  carts: Array<{ cartId: string; quote: PackageSelectionPrice }>;
  subtotalAmount: string;
  deliveryFee: string;
  totalAmount: string;
};

function clampPackageQuantity(cart: CartSummary, requestedCount: number) {
  const minimum = cart.package.minGuestCount;
  const maximum = cart.package.maxGuestCount ?? Number.MAX_SAFE_INTEGER;
  return Math.min(
    Math.max(Math.round(requestedCount) || minimum, minimum),
    maximum,
  );
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
  const [activeCarts, setActiveCarts] = useState<CartSummary[]>([]);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [quote, setQuote] = useState<PackageSelectionPrice>();
  const [multiCartQuote, setMultiCartQuote] = useState<MultiCartQuote>();
  const [pendingOrder, setPendingOrder] = useState<OrderSummary>();
  const [pendingBatch, setPendingBatch] = useState<{
    orderCount: number;
    orderIds: string[];
    totalAmount: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [deletingCartId, setDeletingCartId] = useState('');
  const [updatingCartId, setUpdatingCartId] = useState('');
  const [selectingCartId, setSelectingCartId] = useState('');
  const [error, setError] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('');

  const loadQuote = useCallback(async (currentCartId?: string) => {
    if (!session) return;
    setQuoteLoading(true);
    try {
      const aggregate = await apiRequest<MultiCartQuote>(
        '/cart/quote-all',
        { method: 'POST' },
        session.accessToken,
      );
      const detail = aggregate.carts.find(
        (entry) => entry.cartId === currentCartId,
      )?.quote;
      setMultiCartQuote(aggregate);
      setQuote(detail ?? aggregate.carts[0]?.quote);
      setError(
        aggregate.valid
          ? ''
          : 'The latest quote could not be completed. Please review your delivery details.',
      );
    } catch (reason) {
      setQuote(undefined);
      setMultiCartQuote(undefined);
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
        const [value, allCarts] = await Promise.all([
          apiRequest<CartSummary | null>('/cart', {}, session!.accessToken),
          apiRequest<CartSummary[]>('/cart/all', {}, session!.accessToken),
        ]);
        if (!active || !value) return;
        setCart(value);
        setActiveCarts(allCarts);
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
          const batch = await apiRequest<{
            orderCount: number;
            orderIds: string[];
            totalAmount: string;
          }>(
            `/orders/${value.pendingOrderId}/payment-batch`,
            {},
            session!.accessToken,
          );
          if (active) {
            setPendingOrder(order);
            setPendingBatch(batch);
          }
        } else {
          await loadQuote(value.id);
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
      void apiRequest<CartSummary[]>('/cart/all', {}, session!.accessToken)
        .then((carts) => {
          setActiveCarts(carts);
          if (carts.length && carts.every((entry) => eventReady(entry))) {
            return loadQuote(updated.id);
          }
        })
        .catch((reason) => setError((reason as Error).message));
    },
    [session, hydrate, loadQuote],
  );

  async function updatePackageQuantity(
    packageCart: CartSummary,
    requestedCount: number,
  ) {
    if (!session || updatingCartId || pendingOrder) return;
    const guestCount = clampPackageQuantity(packageCart, requestedCount);
    if (guestCount === packageCart.guestCount) return;
    setUpdatingCartId(packageCart.id);
    setError('');
    try {
      const updated = await apiRequest<CartSummary>(
        `/cart/${packageCart.id}/quantity`,
        {
          method: 'PUT',
          body: JSON.stringify({ guestCount }),
        },
        session.accessToken,
      );
      setActiveCarts((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      if (cart?.id === updated.id) {
        setCart(updated);
        hydrate(updated, session.user.id);
      }
      await loadQuote(cart?.id ?? updated.id);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setUpdatingCartId('');
    }
  }

  async function removeCart(cartId: string) {
    if (!session || deletingCartId || pendingOrder) return;
    setDeletingCartId(cartId);
    setError('');
    try {
      await apiRequest(
        `/cart/${cartId}`,
        { method: 'DELETE' },
        session.accessToken,
      );
      const remaining = await apiRequest<CartSummary[]>(
        '/cart/all',
        {},
        session.accessToken,
      );
      setActiveCarts(remaining);
      if (!remaining.length) {
        reset();
        setCart(undefined);
        setConfig(undefined);
        setQuote(undefined);
        return;
      }
      if (cart?.id === cartId) {
        const next = remaining[0];
        setCart(next);
        hydrate(next, session.user.id);
        setConfig(
          await apiRequest<PackageConfiguration>(
            `/package-versions/${next.packageVersionId}/configuration`,
          ),
        );
      }
      const detailCartId = cart?.id === cartId ? remaining[0].id : cart?.id;
      if (remaining.every((entry) => eventReady(entry))) {
        await loadQuote(detailCartId);
      }
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setDeletingCartId('');
    }
  }

  function editPackageCart(packageCart: CartSummary) {
    if (!session) return;
    hydrate(packageCart, session.user.id);
    const href =
      packageCart.package.type === 'CUSTOM_PACKAGE'
        ? `/packages/build?packageVersionId=${packageCart.packageVersionId}`
        : `/menu/select?packageVersionId=${packageCart.packageVersionId}`;
    router.push(href);
  }

  async function selectPackageCart(packageCart: CartSummary) {
    if (!session || packageCart.id === cart?.id || selectingCartId) return;
    setSelectingCartId(packageCart.id);
    setError('');
    try {
      const configuration = await apiRequest<PackageConfiguration>(
        `/package-versions/${packageCart.packageVersionId}/configuration`,
      );
      setCart(packageCart);
      setConfig(configuration);
      setQuote(
        multiCartQuote?.carts.find((entry) => entry.cartId === packageCart.id)
          ?.quote,
      );
      hydrate(packageCart, session.user.id);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSelectingCartId('');
    }
  }

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
      const orders = pendingOrderId
        ? await apiRequest<OrderSummary>(
            `/orders/${pendingOrderId}`,
            {},
            session.accessToken,
          ).then((order) => [order])
        : await apiRequest<OrderSummary[]>(
            '/cart/checkout-all',
            { method: 'POST' },
            session.accessToken,
          );
      const order = orders[0];
      setPendingOrderId(order.id);
      const gateway =
        orders.length === 1
          ? await apiRequest<GatewayOrder>(
              `/orders/${order.id}/payments/razorpay-order`,
              { method: 'POST' },
              session.accessToken,
            )
          : await apiRequest<GatewayOrder>(
              '/payments/razorpay/batch-order',
              {
                method: 'POST',
                body: JSON.stringify({ orderIds: orders.map((row) => row.id) }),
              },
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
        description:
          orders.length === 1
            ? `${cart.package.name} for ${quote.guestCount} guests`
            : `${orders.length} packages in one checkout`,
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

  const ready =
    activeCarts.length > 0 && activeCarts.every((entry) => eventReady(entry));
  const editHref =
    cart.package.type === 'CUSTOM_PACKAGE'
      ? `/packages/build?packageVersionId=${cart.packageVersionId}`
      : `/menu/select?packageVersionId=${cart.packageVersionId}`;
  const isMealBox = cart.package.type === 'MEAL_BOX';
  const isMultiCart = activeCarts.length > 1;
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
        {isMultiCart && !pendingOrder && (
          <section className="mb-5 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold">
                  Packages in your cart ({activeCarts.length})
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each package keeps its own count and menu. Payment is combined.
                </p>
              </div>
              <Link
                href="/packages"
                className="inline-flex min-h-10 items-center rounded-full border border-primary/30 px-4 text-sm font-bold text-primary hover:bg-primary/5"
              >
                Add another package
              </Link>
            </div>
            <div
              className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Packages in your cart"
            >
              {activeCarts.map((packageCart) => (
                <article
                  key={packageCart.id}
                  className={cn(
                    'min-w-[280px] flex-1 rounded-xl border p-4 transition sm:min-w-[320px]',
                    packageCart.id === cart.id
                      ? 'border-primary bg-primary/[0.045] shadow-sm'
                      : 'border-border bg-ivory/60 hover:border-primary/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={packageCart.id === cart.id}
                        onClick={() => void selectPackageCart(packageCart)}
                        className="block max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <span className="block truncate font-bold text-foreground">
                          {packageCart.package.name}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-primary">
                          {packageCart.id === cart.id
                            ? 'Viewing this menu'
                            : selectingCartId === packageCart.id
                              ? 'Loading menu…'
                              : 'View menu & details'}
                        </span>
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {packageCart.items.length} custom selection
                        {packageCart.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${packageCart.package.name} from cart`}
                      disabled={Boolean(deletingCartId)}
                      onClick={() => void removeCart(packageCart.id)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-white p-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {packageCart.package.type === 'MEAL_BOX'
                        ? 'Box count'
                        : 'Guest count'}
                    </span>
                    <div className="flex items-center overflow-hidden rounded-lg border">
                      <button
                        type="button"
                        aria-label={`Decrease count for ${packageCart.package.name}`}
                        disabled={
                          Boolean(updatingCartId) ||
                          (packageCart.guestCount ??
                            packageCart.package.minGuestCount) <=
                            packageCart.package.minGuestCount
                        }
                        onClick={() =>
                          void updatePackageQuantity(
                            packageCart,
                            (packageCart.guestCount ??
                              packageCart.package.minGuestCount) - 1,
                          )
                        }
                        className="grid h-9 w-9 place-items-center text-primary disabled:opacity-30"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        aria-label={`Count for ${packageCart.package.name}`}
                        inputMode="numeric"
                        defaultValue={
                          packageCart.guestCount ??
                          packageCart.package.minGuestCount
                        }
                        key={`${packageCart.id}-${packageCart.guestCount}`}
                        onBlur={(event) => {
                          const next = clampPackageQuantity(
                            packageCart,
                            Number(event.target.value),
                          );
                          event.currentTarget.value = String(next);
                          void updatePackageQuantity(packageCart, next);
                        }}
                        className="h-9 w-14 border-x text-center text-sm font-bold outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`Increase count for ${packageCart.package.name}`}
                        disabled={
                          Boolean(updatingCartId) ||
                          Boolean(
                            packageCart.package.maxGuestCount &&
                              (packageCart.guestCount ??
                                packageCart.package.minGuestCount) >=
                                packageCart.package.maxGuestCount,
                          )
                        }
                        onClick={() =>
                          void updatePackageQuantity(
                            packageCart,
                            (packageCart.guestCount ??
                              packageCart.package.minGuestCount) + 1,
                          )
                        }
                        className="grid h-9 w-9 place-items-center text-primary disabled:opacity-30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => void selectPackageCart(packageCart)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {packageCart.id === cart.id ? 'Menu selected' : 'Show menu'}
                    </button>
                    <button
                      type="button"
                      onClick={() => editPackageCart(packageCart)}
                      className="text-xs font-bold text-muted-foreground hover:text-primary hover:underline"
                    >
                      Edit package
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {pendingOrder && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Payment is pending.</strong> Your order is safely reserved.
            Retry payment without creating another order.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_392px] lg:items-start">
          <div className="min-w-0 space-y-4">
            {!isMultiCart && (pendingOrder ? (
              <EventSummary cart={cart} />
            ) : (
              <SelectionContextPanel
                packageVersionId={cart.packageVersionId}
                minPax={cart.package.minGuestCount}
                maxPax={cart.package.maxGuestCount}
                hideQuantity
                onSaved={onEventSaved}
              />
            ))}

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
                              : 'border-border bg-ivory text-foreground hover:border-primary/30',
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

            {isMultiCart && (pendingOrder ? (
              <EventSummary cart={cart} />
            ) : (
              <SelectionContextPanel
                key={cart.id}
                packageVersionId={cart.packageVersionId}
                minPax={cart.package.minGuestCount}
                maxPax={cart.package.maxGuestCount}
                hideQuantity
                onSaved={onEventSaved}
              />
            ))}
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_44px_-30px_rgba(75,12,23,.8)]">
              <div className="border-b p-6 pb-4">
                <p className="eyebrow">
                  {pendingOrder ? 'Payment pending' : 'Order summary'}
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold">
                  {activeCarts.length > 1
                    ? `${activeCarts.length} packages`
                    : cart.package.name}
                </h2>
                {!pendingOrder && <OrderFacts cart={cart} />}
              </div>
              {pendingOrder ? (
                <div className="p-6">
                  <div className="flex items-end justify-between border-b pb-5">
                    <span className="font-semibold">Total</span>
                    <strong className="font-serif text-3xl">
                      ₹{pendingBatch?.totalAmount ?? pendingOrder.totalAmount}
                    </strong>
                  </div>
                  <div className="mt-5">
                    <RetryPaymentButton
                      order={pendingOrder}
                      orderIds={pendingBatch?.orderIds}
                    />
                  </div>
                  <Button asChild variant="outline" className="mt-3 w-full">
                    <Link href={`/orders/${pendingOrder.id}`}>
                      View saved order
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="p-6">
                  {multiCartQuote ? (
                    <MultiCartPriceSummary
                      carts={activeCarts}
                      aggregate={multiCartQuote}
                    />
                  ) : (
                    <div className="rounded-xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                      {quoteLoading
                        ? 'Refreshing your final quote…'
                        : 'Confirm the delivery time and venue to calculate the final total.'}
                    </div>
                  )}
                  <div className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.08] p-3">
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
                    disabled={
                      !ready || !multiCartQuote?.valid || quoteLoading || paying
                    }
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
    <article className="grid min-h-[104px] grid-cols-[84px_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-ivory p-2.5 transition hover:border-primary/25">
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
}: {
  cart: CartSummary;
}) {
  const address = cart.event?.address;
  const facts = [
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
    <section className="mt-6 grid gap-0 overflow-hidden rounded-2xl border border-border bg-ivory-warm sm:grid-cols-2 lg:grid-cols-4">
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

function MultiCartPriceSummary({
  carts,
  aggregate,
}: {
  carts: CartSummary[];
  aggregate: MultiCartQuote;
}) {
  const cartById = new Map(carts.map((cart) => [cart.id, cart]));
  const deliveryQuote = aggregate.carts.find(
    ({ quote }) => Number(quote.deliveryFee) > 0,
  )?.quote;
  return (
    <>
      <div className="space-y-3 text-sm">
        {aggregate.carts.map(({ cartId, quote }) => {
          const packageCart = cartById.get(cartId);
          const unitLabel =
            packageCart?.package.type === 'MEAL_BOX' ? 'box' : 'guest';
          return (
            <div key={cartId} className="rounded-xl border p-3">
              <PriceLine
                label={packageCart?.package.name ?? quote.packageName}
                value={formatCurrency(quote.subtotalAmount)}
              />
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {formatMenuCalculation({
                  basePrice: quote.basePerPlatePrice,
                  guestCount: quote.guestCount,
                  unitLabel,
                  items: quote.items,
                })}
              </p>
            </div>
          );
        })}
        <PriceLine
          label="Packages subtotal"
          value={formatCurrency(aggregate.subtotalAmount)}
        />
        <div className="rounded-xl bg-muted/50 p-3">
          <PriceLine
            label="Delivery"
            value={formatCurrency(aggregate.deliveryFee)}
          />
          {deliveryQuote?.region && (
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {deliveryQuote.region.name} kitchen · {deliveryQuote.distanceKm} km
            </p>
          )}
        </div>
      </div>
      <div className="my-5 h-px bg-border" />
      <div className="flex items-end justify-between gap-4">
        <span className="font-semibold">Total</span>
        <strong className="font-serif text-4xl">
          {formatCurrency(aggregate.totalAmount)}
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
