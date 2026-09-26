'use client';
import { MobileOrderBar } from '../../components/mobile-order-bar';

import type {
  CartSummary,
  DeliveryServiceType,
  GatewayOrder,
  OrderSummary,
  PackageConfiguration,
  PackageSelectionPrice,
} from '@aranyam/shared-types';
import { mobileNumberSchema } from '@aranyam/validation';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Truck,
  Utensils,
  UserRound,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RetryPaymentButton } from '../../components/retry-payment-button';
import { SelectionContextPanel } from '../../components/selection-context-panel';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { notifyCartCleared } from '../../lib/cart-state';
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
  weightGrams?: number | null;
  pricePerKg?: string | null;
  lineTotal?: string | null;
  totalAdjustmentAmount?: string;
};

type MultiCartQuote = {
  valid: boolean;
  carts: Array<{ cartId: string; quote: PackageSelectionPrice }>;
  subtotalAmount: string;
  cutleryTotal?: string;
  deliveryFee: string;
  totalAmount: string;
};

function withoutCartQuote(
  aggregate: MultiCartQuote | undefined,
  cartId: string,
) {
  if (!aggregate) return undefined;
  const carts = aggregate.carts.filter((entry) => entry.cartId !== cartId);
  if (!carts.length) return undefined;
  const subtotal = carts.reduce(
    (sum, entry) => sum + Number(entry.quote.subtotalAmount),
    0,
  );
  const delivery = Math.max(
    0,
    ...carts.map((entry) => Number(entry.quote.deliveryFee)),
  );
  const cutlery = Math.max(
    0,
    ...carts.map((entry) => Number(entry.quote.cutleryTotal ?? 0)),
  );
  return {
    ...aggregate,
    carts,
    subtotalAmount: subtotal.toFixed(2),
    cutleryTotal: cutlery.toFixed(2),
    deliveryFee: delivery.toFixed(2),
    totalAmount: (subtotal + cutlery + delivery).toFixed(2),
  };
}

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
  const [clearCartOpen, setClearCartOpen] = useState(false);
  const [clearingCart, setClearingCart] = useState(false);
  const [updatingCartId, setUpdatingCartId] = useState('');
  const [selectingCartId, setSelectingCartId] = useState('');
  const [error, setError] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [updatingDelivery, setUpdatingDelivery] = useState(false);

  useEffect(() => {
    setContactNumber(session?.user.mobileNumber ?? '');
  }, [session?.user.mobileNumber]);

  const loadQuote = useCallback(
    async (currentCartId?: string) => {
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
    },
    [session],
  );

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
        setSpecialNotes(value.specialNotes ?? '');
        setContactNumber(value.contactNumber || session!.user.mobileNumber);
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
      if (!session) return;
      setCart(updated);
      setActiveCarts((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      hydrate(updated);
      const event = updated.event;
      const addressId = event?.address?.id ?? updated.address?.id;
      const regionId = event?.region?.id ?? updated.region?.id;
      if (!addressId || !regionId) return;
      const completeEvent = Boolean(event?.eventDate && event.eventTimeStart);
      void Promise.all(
        activeCarts.map((packageCart) => {
          if (packageCart.id === updated.id) return Promise.resolve(updated);
          return apiRequest<CartSummary>(
            `/cart/${packageCart.id}`,
            {
              method: 'PUT',
              body: JSON.stringify({
                packageVersionId: packageCart.packageVersionId,
                addressId,
                regionId,
                ...(completeEvent
                  ? {
                      eventName: packageCart.package.name,
                      eventDate: event!.eventDate,
                      eventTimeStart: event!.eventTimeStart,
                      guestCount:
                        packageCart.guestCount ??
                        packageCart.package.minGuestCount,
                    }
                  : {}),
              }),
            },
            session.accessToken,
          );
        }),
      )
        .then((carts) => {
          const sorted = carts.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          setActiveCarts(sorted);
          setCart(sorted.find((entry) => entry.id === updated.id) ?? updated);
          if (sorted.every((entry) => eventReady(entry))) {
            return loadQuote(updated.id);
          }
          return undefined;
        })
        .catch((reason) => setError((reason as Error).message));
    },
    [session, hydrate, loadQuote, activeCarts],
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
        hydrate(updated);
      }
      await loadQuote(cart?.id ?? updated.id);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setUpdatingCartId('');
    }
  }

  async function updateDeliveryService(
    deliveryServiceType: DeliveryServiceType,
    helperCount: number,
  ) {
    if (!session || !cart || updatingDelivery || pendingOrder) return;
    setUpdatingDelivery(true);
    setError('');
    try {
      const updatedCarts = await Promise.all(
        activeCarts.map((packageCart) =>
          apiRequest<CartSummary>(
            `/cart/${packageCart.id}`,
            {
              method: 'PUT',
              body: JSON.stringify({
                packageVersionId: packageCart.packageVersionId,
                deliveryServiceType,
                helperCount,
              }),
            },
            session.accessToken,
          ),
        ),
      );
      setActiveCarts(updatedCarts);
      const updated = updatedCarts.find((entry) => entry.id === cart.id);
      if (updated) {
        setCart(updated);
        hydrate(updated);
      }
      await loadQuote(cart.id);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setUpdatingDelivery(false);
    }
  }

  async function updateCutleryExtraCount(nextCount: number) {
    if (!session || !cart || updatingDelivery || pendingOrder) return;
    const cutleryExtraCount = Math.max(0, Math.round(nextCount));
    setUpdatingDelivery(true);
    setError('');
    try {
      const updatedCarts = await Promise.all(
        activeCarts.map((packageCart) =>
          apiRequest<CartSummary>(
            `/cart/${packageCart.id}`,
            {
              method: 'PUT',
              body: JSON.stringify({
                packageVersionId: packageCart.packageVersionId,
                cutleryExtraCount,
              }),
            },
            session.accessToken,
          ),
        ),
      );
      setActiveCarts(updatedCarts);
      const updated = updatedCarts.find((entry) => entry.id === cart.id);
      if (updated) {
        setCart(updated);
        hydrate(updated);
      }
      await loadQuote(cart.id);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setUpdatingDelivery(false);
    }
  }

  async function persistContactNumber(value: string) {
    if (!session || !cart) return;
    const updatedCarts = await Promise.all(
      activeCarts.map((packageCart) =>
        apiRequest<CartSummary>(
          `/cart/${packageCart.id}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              packageVersionId: packageCart.packageVersionId,
              contactNumber: value,
            }),
          },
          session.accessToken,
        ),
      ),
    );
    setActiveCarts(updatedCarts);
    const updated = updatedCarts.find((entry) => entry.id === cart.id);
    if (updated) {
      setCart(updated);
      hydrate(updated);
    }
  }

  async function saveContactNumber() {
    const validated = mobileNumberSchema.safeParse(contactNumber);
    if (!validated.success) {
      setError('Enter a valid 10-digit contact number to continue.');
      return;
    }
    setSavingContact(true);
    setError('');
    try {
      await persistContactNumber(validated.data);
      setEditingContact(false);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSavingContact(false);
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
      const remaining = activeCarts.filter((entry) => entry.id !== cartId);
      setActiveCarts(remaining);
      setMultiCartQuote((current) => withoutCartQuote(current, cartId));
      window.dispatchEvent(new Event('cart-updated'));
      if (!remaining.length) {
        reset();
        setCart(undefined);
        setConfig(undefined);
        setQuote(undefined);
        setMultiCartQuote(undefined);
        return;
      }
      if (cart?.id === cartId) {
        const next = remaining[0];
        setCart(next);
        setQuote(
          multiCartQuote?.carts.find((entry) => entry.cartId === next.id)
            ?.quote,
        );
        hydrate(next);
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

  async function clearCart() {
    if (!session || clearingCart || pendingOrder) return;
    setClearingCart(true);
    setError('');
    try {
      await apiRequest('/cart', { method: 'DELETE' }, session.accessToken);
      reset();
      setActiveCarts([]);
      setCart(undefined);
      setConfig(undefined);
      setQuote(undefined);
      setMultiCartQuote(undefined);
      setClearCartOpen(false);
      notifyCartCleared();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setClearingCart(false);
    }
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
      hydrate(packageCart);
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
          weightGrams: item.weightGrams,
          pricePerKg: item.pricePerKg ?? configured?.pricePerKg,
          lineTotal: item.lineTotal,
          totalAdjustmentAmount: item.totalAdjustmentAmount,
        };
      });
    }

    if (
      config.packageType === 'CUSTOM_PACKAGE' ||
      config.packageType === 'ORDER_BY_KG'
    ) {
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
          weightGrams: item.weightGrams,
          pricePerKg: item.pricePerKg ?? configured?.pricePerKg,
          lineTotal: item.lineTotal,
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
          weightGrams: item.weightGrams,
          pricePerKg: item.pricePerKg ?? configured?.pricePerKg,
          lineTotal: item.lineTotal,
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
    if (!session || !cart || !ready || !multiCartQuote?.valid) return;
    const validatedContactNumber = mobileNumberSchema.safeParse(contactNumber);
    if (!validatedContactNumber.success) {
      setError('Enter a valid 10-digit contact number to continue.');
      return;
    }
    setError('');
    setPaying(true);
    try {
      await persistContactNumber(validatedContactNumber.data);
      const selectedQuote =
        multiCartQuote.carts.find((entry) => entry.cartId === cart.id)?.quote ??
        quote;
      const orders = pendingOrderId
        ? await apiRequest<OrderSummary>(
            `/orders/${pendingOrderId}`,
            {},
            session.accessToken,
          ).then((order) => [order])
        : await apiRequest<OrderSummary[]>(
            '/cart/checkout-all',
            {
              method: 'POST',
              body: JSON.stringify({ specialNotes }),
            },
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
            ? cart.package.type === 'ORDER_BY_KG'
              ? `${cart.package.name} · ${cart.items.reduce((sum, item) => sum + (item.weightGrams ?? 0), 0) / 1000} kg`
              : `${cart.package.name} for ${selectedQuote?.guestCount ?? cart.guestCount ?? cart.package.minGuestCount} guests`
            : `${orders.length} packages in one checkout`,
        order_id: gateway.id,
        prefill: {
          name: session.user.name ?? '',
          email: session.user.email ?? '',
          contact: validatedContactNumber.data,
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

  function requestPayment() {
    if (!ready) {
      const missingAddress = activeCarts.some(
        (entry) => !entry.event?.address || !entry.event.region,
      );
      const missingDate = activeCarts.some((entry) => !entry.event?.eventDate);
      const missingTime = activeCarts.some(
        (entry) => !entry.event?.eventTimeStart,
      );
      setError(
        missingAddress
          ? 'Add a delivery address to continue.'
          : missingDate
            ? 'Choose a delivery date to continue.'
            : missingTime
              ? 'Choose a delivery time to continue.'
              : 'Complete the required delivery details to continue.',
      );
      document
        .getElementById('checkout-delivery')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        const selector = missingDate
          ? '[aria-label="Choose delivery date"]'
          : missingTime
            ? '[aria-label="Choose delivery time"]'
            : 'a[href^="/addresses"]';
        document.querySelector<HTMLElement>(`#checkout-delivery ${selector}`)?.focus();
      }, 250);
      return;
    }
    if (!mobileNumberSchema.safeParse(contactNumber).success) {
      setEditingContact(true);
      setError('Enter a valid 10-digit contact number to continue.');
      document
        .getElementById('checkout-contact')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(
        () => document.getElementById('cart-contact-number')?.focus(),
        250,
      );
      return;
    }
    void pay();
  }

  if (!session) {
    return (
      <AuthRequiredPanel
        title="Sign in to resume your order"
        description="Your menu is saved. Sign in to add event details and continue to payment."
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
    cart.package.type === 'ORDER_BY_KG'
      ? `/order-by-kg?packageVersionId=${cart.packageVersionId}&cartId=${cart.id}`
      : cart.package.type === 'CUSTOM_PACKAGE'
        ? `/packages/build?packageVersionId=${cart.packageVersionId}&cartId=${cart.id}`
        : `/menu/select?packageVersionId=${cart.packageVersionId}&cartId=${cart.id}`;
  const isMealBox = cart.package.type === 'MEAL_BOX';
  const isMultiCart = activeCarts.length > 1;
  const mobileTotal = pendingOrder
    ? (pendingBatch?.totalAmount ?? pendingOrder.totalAmount)
    : multiCartQuote?.totalAmount;

  return (
    <main className="bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] lg:pb-10">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />

      <div className="mx-auto w-full max-w-[1320px] px-3 py-4 sm:px-5 sm:py-5 lg:px-8">
        <header className="mb-2 sm:mb-4">
          <h1 className="font-serif text-xl font-semibold leading-tight text-foreground sm:text-2xl">
            Complete your order
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Confirm delivery and order details.
          </p>
        </header>
        {isMultiCart && !pendingOrder && (
          <section className="mb-5 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-sans text-xl font-semibold">
                  Packages in your cart ({activeCarts.length})
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Delivery details, service choice, cutlery, and contact stay
                  common. Select a package to review only its menu.
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
              {activeCarts.map((packageCart, packageIndex) => (
                <article
                  key={packageCart.id}
                  className={cn(
                    'group relative min-w-[280px] flex-1 rounded-xl border p-4 transition-all sm:min-w-[320px]',
                    packageCart.id === cart.id
                      ? 'border-primary bg-primary/[0.055] shadow-sm ring-1 ring-primary/15'
                      : 'border-border bg-ivory/60 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white hover:shadow-md',
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={packageCart.id === cart.id}
                    aria-label={`View ${packageCart.package.name} menu and details`}
                    disabled={
                      packageCart.id === cart.id || Boolean(selectingCartId)
                    }
                    onClick={() => void selectPackageCart(packageCart)}
                    className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-default"
                  />
                  <div className="pointer-events-none flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block truncate font-bold text-foreground">
                          {packageCart.package.name}
                        </span>
                        {packageCart.id === cart.id && (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-label="Selected package"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectingCartId === packageCart.id
                          ? 'Updating menu…'
                          : `${
                              activeCarts.filter(
                                (entry) =>
                                  entry.packageVersionId ===
                                  packageCart.packageVersionId,
                              ).length > 1
                                ? `Order ${
                                    activeCarts
                                      .slice(0, packageIndex + 1)
                                      .filter(
                                        (entry) =>
                                          entry.packageVersionId ===
                                          packageCart.packageVersionId,
                                      ).length
                                  } · `
                                : ''
                            }${packageCart.items.length} custom selection${packageCart.items.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${packageCart.package.name} from cart`}
                      disabled={Boolean(deletingCartId)}
                      onClick={() => void removeCart(packageCart.id)}
                      className="pointer-events-auto relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {packageCart.package.type === 'ORDER_BY_KG' ? (
                    <p className="mt-3 rounded-lg border bg-white p-3 text-sm font-semibold">
                      {packageCart.items.reduce(
                        (sum, item) => sum + (item.weightGrams ?? 0),
                        0,
                      ) / 1000}{' '}
                      kg total · Edit dish weights below
                    </p>
                  ) : (
                    <div className="relative z-10 mt-3 flex items-center justify-between gap-3 rounded-lg border bg-white p-2">
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
                  )}
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

        <div className="grid gap-x-10 gap-y-2.5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)] lg:items-start">
          <div className="min-w-0 space-y-2.5">
            {/* {isMultiCart && !pendingOrder && (
              <section className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
                    <Truck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="eyebrow">Shared delivery setup</p>
                    <h2 className="mt-1 font-sans text-xl font-semibold text-foreground">
                      One delivery plan for all packages
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Venue, delivery time, serving option, cutlery, contact
                      number, and kitchen note apply to every package in this
                      cart. Only the menu section below changes when you switch
                      packages.
                    </p>
                  </div>
                </div>
              </section>
            )} */}
            {pendingOrder ? (
              <EventSummary cart={cart} />
            ) : (
              <SelectionContextPanel
                checkoutCompact
                cartId={cart.id}
                packageVersionId={cart.packageVersionId}
                minPax={cart.package.minGuestCount}
                maxPax={cart.package.maxGuestCount}
                hideQuantity
                deliveryService={
                  <>
                    <DeliveryServiceOptions
                      cart={cart}
                      quote={quote}
                      disabled={updatingDelivery}
                      onChange={updateDeliveryService}
                    />
                    <CutleryOptions
                      cart={cart}
                      quote={quote}
                      disabled={updatingDelivery}
                      onChange={updateCutleryExtraCount}
                    />
                  </>
                }
                onSaved={onEventSaved}
              />
            )}

            <section className="rounded-lg border border-border/60 bg-white/80 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-foreground">Your order</h2>
                {!pendingOrder && (
                  <Link
                    href={editHref}
                    className="inline-flex min-h-8 shrink-0 items-center px-1 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Edit
                  </Link>
                )}
              </div>
              <div className="mt-1.5 min-w-0">
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {cart.package.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewRows.length} {reviewRows.length === 1 ? 'dish' : 'dishes'} ·{' '}
                    {cart.package.type === 'ORDER_BY_KG'
                      ? `${cart.items.reduce((sum, item) => sum + (item.weightGrams ?? 0), 0) / 1000} kg`
                      : `${quote?.guestCount ?? cart.guestCount ?? cart.package.minGuestCount} ${isMealBox ? 'boxes' : 'guests'}`}
                  </p>
              </div>
              {/* <div className="mt-1.5 flex flex-wrap gap-1.5">
                {groupedRows.map((group) => (
                  <span
                    key={group.id}
                    className="rounded-sm bg-background/80 px-2 py-0.5 text-xs leading-5 text-muted-foreground"
                  >
                    {formatCategoryCount(group.name, group.rows.length)}
                  </span>
                ))}
              </div> */}
              <details className="group mt-0.5">
                <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <span className="group-open:hidden">View menu →</span>
                  <span className="hidden group-open:inline">Hide menu ↑</span>
                </summary>
                <div className="mt-2 space-y-3 border-t border-border/60 pt-3">
                  {groupedRows.map((group) => (
                    <section key={group.id}>
                      <h3 className="text-[11px] font-bold uppercase text-primary">
                        {group.name}
                      </h3>
                      <ul className="mt-1 flex flex-wrap gap-x-2 text-sm leading-6 text-foreground">
                        {group.rows.map((row) => (
                          <li key={row.id}>
                            {row.name}
                            {row.role === 'EXTRA' ? ' (extra)' : ''}
                            {row.replacedName ? ` (replaces ${row.replacedName})` : ''}
                            {group.rows.at(-1)?.id !== row.id ? ',' : ''}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </details>
            </section>
            {!pendingOrder && (
              <section
                id="checkout-contact"
                className="rounded-lg border border-border/60 bg-white/80 p-3 sm:p-4"
              >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-foreground">Contact</h2>
                    </div>
                    <button
                      type="button"
                      disabled={savingContact}
                      onClick={() =>
                        editingContact
                          ? void saveContactNumber()
                          : setEditingContact(true)
                      }
                      className="inline-flex min-h-8 shrink-0 items-center px-1 text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                    >
                      {savingContact ? 'Saving…' : editingContact ? 'Save' : 'Edit'}
                    </button>
                  </div>
                  {!editingContact && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {contactNumber ? `+91 ${contactNumber}` : 'Add a contact number'}
                    </p>
                  )}
                  {editingContact && (
                    <div className="mt-2 flex min-h-12 max-w-sm items-center overflow-hidden rounded-lg border border-input bg-white focus-within:ring-2 focus-within:ring-primary/30">
                      <label
                        htmlFor="cart-contact-number"
                        className="border-r px-3 text-sm font-semibold text-muted-foreground"
                      >
                        +91
                      </label>
                      <Input
                        id="cart-contact-number"
                        aria-label="Contact number"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        autoFocus
                        value={contactNumber}
                        onChange={(event) =>
                          setContactNumber(
                            event.target.value.replace(/\D/g, '').slice(0, 10),
                          )
                        }
                        maxLength={10}
                        placeholder="9876543210"
                        required
                        className="min-h-11 rounded-none border-0 focus-visible:ring-0"
                      />
                    </div>
                  )}
                <div className="mt-1.5 border-t border-border/60 pt-1">
                  {specialNotes && !notesExpanded ? (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">Kitchen note</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          “{specialNotes}”
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotesExpanded(true)}
                        className="min-h-8 shrink-0 px-1 text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Edit
                      </button>
                    </div>
                  ) : notesExpanded ? (
                    <div>
                      <label
                        htmlFor="special-kitchen-request"
                        className="flex items-center justify-between gap-4 text-sm font-semibold"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
                          Special request for the kitchen
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {specialNotes.length}/1000
                        </span>
                      </label>
                      <textarea
                        id="special-kitchen-request"
                        value={specialNotes}
                        onChange={(event) => setSpecialNotes(event.target.value)}
                        placeholder="e.g. Keep the food mildly spiced and pack chutney separately."
                        maxLength={1000}
                        rows={3}
                        className="mt-1.5 w-full max-w-2xl resize-y rounded-md border border-border bg-background p-2.5 text-sm leading-6 outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                      <button
                        type="button"
                        onClick={() => setNotesExpanded(false)}
                        className="min-h-8 text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNotesExpanded(true)}
                      className="inline-flex min-h-8 items-center gap-2 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add a note for the kitchen
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <section className="rounded-lg border border-border/60 bg-white/80 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">
                    {pendingOrder ? 'Payment pending' : 'Order summary'}
                  </h2>
                  {activeCarts.length > 1 && !pendingOrder && (
                    <p className="text-xs text-muted-foreground">
                      {activeCarts.length} packages
                    </p>
                  )}
                </div>
                {!pendingOrder && (
                  <button
                    type="button"
                    aria-label="Clear cart"
                    title="Clear cart"
                    onClick={() => setClearCartOpen(true)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              {pendingOrder ? (
                <div>
                  <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-2">
                    <span className="font-semibold">Total</span>
                    <strong className="money-text text-lg font-bold text-primary">
                      {formatCheckoutCurrency(pendingBatch?.totalAmount ?? pendingOrder.totalAmount)}
                    </strong>
                  </div>
                  <div className="mt-4">
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
                <div>
                  {multiCartQuote ? (
                    <MultiCartPriceSummary
                      carts={activeCarts}
                      aggregate={multiCartQuote}
                    />
                  ) : (
                    <p className="text-sm leading-5 text-muted-foreground">
                      {quoteLoading
                        ? 'Refreshing your final quote…'
                        : 'Confirm delivery details to calculate your total.'}
                    </p>
                  )}
                  {error && (
                    <p
                      role="alert"
                      className="mt-3 text-sm font-medium text-red-800"
                    >
                      {error}
                    </p>
                  )}
                  <div className="hidden lg:block">
                    <Button
                      className="mt-3 h-11 w-full"
                      onClick={requestPayment}
                      disabled={quoteLoading || paying}
                    >
                      <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
                      {paying
                        ? 'Opening payment…'
                        : ready && mobileNumberSchema.safeParse(contactNumber).success
                          ? 'Pay securely'
                          : 'Complete details'}
                    </Button>
                    <p className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                      <LockKeyhole className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Secure payment
                    </p>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>

        {clearCartOpen && !pendingOrder && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-cart-title"
          >
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Keep cart"
              onClick={() => setClearCartOpen(false)}
            />
            <section className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-700">
                <Trash2 className="h-5 w-5" />
              </span>
              <h2
                id="clear-cart-title"
                className="mt-4 font-sans text-2xl font-semibold"
              >
                Clear your entire cart?
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This removes all {activeCarts.length} package
                {activeCarts.length === 1 ? '' : 's'}, their menu selections,
                quantities, and event details.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClearCartOpen(false)}
                  disabled={clearingCart}
                >
                  Keep cart
                </Button>
                <button
                  type="button"
                  onClick={() => void clearCart()}
                  disabled={clearingCart}
                  className="rounded-full bg-red-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60"
                >
                  {clearingCart ? 'Clearing…' : 'Clear entire cart'}
                </button>
              </div>
            </section>
          </div>
        )}

      </div>

      <MobileOrderBar checkout label="Cart total and payment">
        <div className="mobile-order-bar-row">
          <div className="mobile-order-bar-summary">
            <strong className="mobile-order-bar-total">
              {mobileTotal != null
                ? formatCheckoutCurrency(mobileTotal)
                : quoteLoading
                  ? 'Updating…'
                  : 'Add event details'}
            </strong>
          </div>
          {pendingOrder ? (
            <RetryPaymentButton
              order={pendingOrder}
              orderIds={pendingBatch?.orderIds}
              className="mobile-order-bar-action"
            />
          ) : (
            <Button
              className="mobile-order-bar-action"
              onClick={requestPayment}
              disabled={quoteLoading || paying}
            >
              <LockKeyhole className="mr-2 h-4 w-4" />
              {paying
                ? 'Opening…'
                : ready && mobileNumberSchema.safeParse(contactNumber).success
                  ? 'Pay securely'
                  : 'Complete details'}
            </Button>
          )}
        </div>
      </MobileOrderBar>
    </main>
  );
}

function eventReady(cart: CartSummary) {
  return Boolean(
    cart.event?.address &&
    cart.event.region &&
    cart.event.eventDate &&
    cart.event.eventTimeStart &&
    (cart.package.type === 'ORDER_BY_KG' || cart.event.guestCount),
  );
}

function formatVenueAddress(
  address?: CartSummary['address'] | null,
  maxLines = 4,
) {
  if (!address) return 'Not set';
  const lines = [
    address.label,
    address.addressLine1,
    address.addressLine2,
    address.landmark ? `Landmark: ${address.landmark}` : undefined,
    [address.city, address.pincode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .map((line) => String(line).trim())
    .filter(Boolean);
  return lines.length ? lines.slice(0, maxLines).join(', ') : 'Not set';
}

function EventSummary({ cart }: { cart: CartSummary }) {
  const address = cart.event?.address ?? cart.address;
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
          label={
            cart.package.type === 'ORDER_BY_KG'
              ? 'Weight'
              : cart.package.type === 'MEAL_BOX'
                ? 'Boxes'
                : 'Guests'
          }
          value={
            cart.package.type === 'ORDER_BY_KG'
              ? `${cart.items.reduce((sum, item) => sum + (item.weightGrams ?? 0), 0) / 1000} kg`
              : String(cart.event?.guestCount ?? cart.guestCount ?? 'Not set')
          }
        />
        <Info icon={MapPin} label="Venue" value={formatVenueAddress(address)} />
      </div>
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
  const assistedQuote = aggregate.carts.find(
    ({ quote }) => quote.deliveryServiceType === 'ASSISTED',
  )?.quote;
  const assistedPeople = assistedQuote?.helperCount ?? 0;
  const extraCutleryCount = Math.max(
    0,
    ...aggregate.carts.map((entry) => entry.quote.cutleryExtraCount ?? 0),
  );
  const cutleryTotal = Number(aggregate.cutleryTotal ?? 0);
  const deliveryLabel = assistedPeople
    ? `Delivery · Serving team · ${assistedPeople} ${assistedPeople === 1 ? 'person' : 'people'}`
    : 'Delivery';
  return (
    <div>
      <div className="space-y-1.5">
        {aggregate.carts.map(({ cartId, quote }) => {
          const packageCart = cartById.get(cartId);
          const unitLabel =
            packageCart?.package.type === 'MEAL_BOX' ? 'box' : 'guest';
          const isKg =
            packageCart?.package.type === 'ORDER_BY_KG' ||
            quote.packageType === 'ORDER_BY_KG';
          const packageCalculation =
            quote.finalPerPlatePrice != null &&
            quote.guestCount != null &&
            !isKg
              ? `${formatCheckoutCurrency(quote.finalPerPlatePrice)} × ${quote.guestCount} ${quote.guestCount === 1 ? unitLabel : unitLabel === 'box' ? 'boxes' : 'guests'}`
              : formatMenuCalculation({
                  basePrice: quote.basePerPlatePrice,
                  guestCount: quote.guestCount,
                  unitLabel,
                  items: quote.items,
                }).replace(/\.00/g, '');
          return (
            <div
              key={cartId}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {packageCart?.package.name ?? quote.packageName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {packageCalculation}
                </p>
              </div>
              <strong className="money-text shrink-0 text-sm font-semibold text-foreground">
                {formatCheckoutCurrency(quote.subtotalAmount)}
              </strong>
            </div>
          );
        })}
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {extraCutleryCount > 0 && (
          <PriceLine
            label={`Extra cutlery · ${extraCutleryCount} ${extraCutleryCount === 1 ? 'set' : 'sets'}`}
            value={formatCheckoutCurrency(cutleryTotal)}
          />
        )}
        <PriceLine
          label={deliveryLabel}
          value={Number(aggregate.deliveryFee) === 0
            ? 'Included'
            : formatCheckoutCurrency(aggregate.deliveryFee)}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-2">
        <span className="font-semibold">Total</span>
        <strong className="money-text text-base font-bold text-primary">
          {formatCheckoutCurrency(aggregate.totalAmount)}
        </strong>
      </div>
    </div>
  );
}

function formatCheckoutCurrency(value: string | number | null | undefined) {
  return formatCurrency(value).replace(/\.00$/, '');
}

function CutleryOptions({
  cart,
  quote,
  disabled,
  onChange,
}: {
  cart: CartSummary;
  quote?: PackageSelectionPrice;
  disabled: boolean;
  onChange: (count: number) => void;
}) {
  const includedCount =
    quote?.cutleryIncludedCount ?? cart.cutleryIncludedCount ?? 0;
  const extraCount = quote?.cutleryExtraCount ?? cart.cutleryExtraCount ?? 0;
  const unitPrice = quote?.cutleryUnitPrice ?? cart.cutleryUnitPrice ?? '5.00';
  const total = Number(quote?.cutleryTotal ?? 0);

  return (
    <section className="mt-3 rounded-md border border-border/55 bg-white/75 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Utensils className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Cutlery</h3>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {includedCount} included
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Plate + Spoon · Extra {formatCurrency(unitPrice).replace(/\.00$/, '')}/set
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Extra sets</span>
        <div className="flex min-w-0 items-center gap-2">
          <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border bg-background">
            <button
              type="button"
              disabled={disabled || extraCount <= 0}
              onClick={() => onChange(extraCount - 1)}
              className="grid h-9 w-9 place-items-center text-foreground/75 transition hover:bg-primary/[0.06] hover:text-primary disabled:text-muted-foreground/35"
              aria-label="Decrease extra cutlery sets"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <label htmlFor="extra-cutlery-count" className="sr-only">
              Extra cutlery sets
            </label>
            <input
              id="extra-cutlery-count"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={disabled}
              defaultValue={extraCount}
              key={extraCount}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={(event) => {
                const next = Math.max(
                  0,
                  Math.min(10000, Math.round(Number(event.target.value) || 0)),
                );
                event.currentTarget.value = String(next);
                if (next !== extraCount) onChange(next);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              onChange={(event) => {
                event.currentTarget.value = event.currentTarget.value
                  .replace(/\D/g, '')
                  .slice(0, 5);
              }}
              className="money-text h-9 w-9 border-x border-border bg-transparent text-center text-sm font-semibold text-foreground outline-none focus:bg-primary/[0.03] disabled:opacity-60"
              aria-describedby="additional-cutlery-help"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(extraCount + 1)}
              className="grid h-9 w-9 place-items-center text-foreground/75 transition hover:bg-primary/[0.06] hover:text-primary disabled:opacity-50"
              aria-label="Increase extra cutlery sets"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <span
            id="additional-cutlery-help"
            className="money-text min-w-8 text-right text-xs font-semibold text-foreground"
          >
            {formatCurrency(total).replace(/\.00$/, '')}
          </span>
        </div>
      </div>
    </section>
  );
}

function DeliveryServiceOptions({
  cart,
  quote,
  disabled,
  onChange,
}: {
  cart: CartSummary;
  quote?: PackageSelectionPrice;
  disabled: boolean;
  onChange: (
    deliveryServiceType: DeliveryServiceType,
    helperCount: number,
  ) => void;
}) {
  const selected = cart.deliveryServiceType ?? 'STANDARD';
  const helperCount = cart.helperCount || 1;
  const baseDelivery = Number(
    quote?.baseDeliveryFee ?? quote?.deliveryFee ?? 0,
  );
  const options: Array<{
    type: DeliveryServiceType;
    title: string;
    description: string;
    addon: number;
    icon: typeof Truck;
  }> = [
    {
      type: 'STANDARD',
      title: 'Standard Delivery',
      description: 'Building/office entrance',
      addon: 0,
      icon: Truck,
    },
    {
      type: 'DOORSTEP',
      title: 'Doorstep Delivery',
      description: 'Delivered to your doorstep',
      addon: 399,
      icon: Package,
    },
    {
      type: 'ASSISTED',
      title: 'Delivery & Serving Team',
      description: '3-hour serving assistance',
      addon: helperCount * 999,
      icon: UserRound,
    },
  ];

  return (
    <section className="mt-3">
      <h3 className="mb-2 text-sm font-bold">Delivery service</h3>
      <div
        className="rounded-md border border-border/55 bg-white/75 p-1.5"
        role="radiogroup"
        aria-label="Delivery service"
      >
        {options.map(({ type, title, description, addon, icon: Icon }, index) => {
          const isSelected = selected === type;
          const total = baseDelivery + addon;
          const priceLabel =
            addon === 0
              ? total === 0
                ? 'Included'
                : formatCurrency(total).replace(/\.00$/, '')
              : `+${formatCurrency(addon).replace(/\.00$/, '')}`;
          return (
            <div
              key={type}
              className={cn(
                'transition-colors',
                isSelected
                  ? cn(
                      'rounded-sm bg-primary/[0.045]',
                      index < options.length - 1 && 'border-b border-border/60',
                    )
                  : 'border-b border-border/60 last:border-b-0',
                disabled && 'opacity-70',
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() =>
                  onChange(type, type === 'ASSISTED' ? helperCount : 0)
                }
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isSelected ? 'min-h-12' : 'min-h-11',
                )}
              >
                <span
                  className={cn(
                    'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                    isSelected
                      ? 'border-primary bg-primary text-white'
                      : 'border-muted-foreground/60 bg-white',
                  )}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate whitespace-nowrap text-sm font-semibold text-foreground">
                    {title}
                  </strong>
                  <span className="block truncate whitespace-nowrap text-xs leading-4 text-muted-foreground">
                    {description}
                  </span>
                </span>
                <span
                  className={cn(
                    'money-text shrink-0 text-sm font-semibold',
                    isSelected ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {priceLabel}
                </span>
              </button>
              {type === 'ASSISTED' && isSelected && (
                <div className="flex items-center justify-between border-t border-primary/10 px-3 py-2 pl-11">
                  <span className="text-xs text-muted-foreground">
                    Service people
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={disabled || helperCount <= 1}
                      aria-label="Remove helper"
                      onClick={() => onChange('ASSISTED', helperCount - 1)}
                      className="grid h-8 w-8 place-items-center rounded-md border text-primary disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <strong className="min-w-4 text-center text-sm">
                      {helperCount}
                    </strong>
                    <button
                      type="button"
                      disabled={disabled || helperCount >= 10}
                      aria-label="Add helper"
                      onClick={() => onChange('ASSISTED', helperCount + 1)}
                      className="grid h-8 w-8 place-items-center rounded-md border text-primary disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PriceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="money-text font-bold text-foreground">{value}</span>
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
        <p className="text-xs font-bold text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm leading-6">{value}</p>
      </div>
    </div>
  );
}
