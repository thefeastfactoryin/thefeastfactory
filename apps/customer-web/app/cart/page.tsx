'use client';
import { MobileOrderBar } from '../../components/mobile-order-bar';

import type {
  CartSummary,
  DeliveryServiceType,
  GatewayOrder,
  LocationResolution,
  OrderSummary,
  PackageConfiguration,
  PackageSelectionPrice,
  AddressType,
  UserAddress,
} from '@aranyam/shared-types';
import { createAddressSchema, mobileNumberSchema } from '@aranyam/validation';
import {
  Check,
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
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SelectionContextPanel } from '../../components/selection-context-panel';
import type { VenueServiceability } from '../../components/selection-context-panel';
import { Button } from '../../components/ui/button';
import { Field, Select } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import {
  isClearedCartError,
  notifyCartCleared,
  subscribeToCartCleared,
} from '../../lib/cart-state';
import { formatCurrency } from '../../lib/format';
import { sortMenuCategories } from '../../lib/menu-category-order';
import { cn } from '../../lib/utils';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { useAddressBookStore } from '../../store/address-book.store';
import { useDeliveryLocationStore } from '../../store/delivery-location.store';
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

type CartAddressForm = {
  addressType: AddressType;
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  latitude: string;
  longitude: string;
};

const emptyCartAddressForm: CartAddressForm = {
  addressType: 'HOME',
  label: 'Home',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  latitude: '',
  longitude: '',
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

function publishCheckoutCartCount(count: number) {
  window.dispatchEvent(
    new CustomEvent('checkout-cart-count', { detail: { count } }),
  );
}

function clampPackageQuantity(cart: CartSummary, requestedCount: number) {
  const minimum = cart.package.minGuestCount;
  const maximum = cart.package.maxGuestCount ?? Number.MAX_SAFE_INTEGER;
  return Math.min(
    Math.max(Math.round(requestedCount) || minimum, minimum),
    maximum,
  );
}

function groupOrderItems(
  rows: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    name: string;
    role?: string | null;
    replacedName?: string | null;
  }>,
) {
  return rows.reduce<
    Array<{
      id: string;
      name: string;
      rows: Array<{
        id: string;
        name: string;
        role?: string | null;
        replacedName?: string | null;
      }>;
    }>
  >((groups, row) => {
    let group = groups.find((entry) => entry.id === row.categoryId);
    if (!group) {
      group = { id: row.categoryId, name: row.categoryName, rows: [] };
      groups.push(group);
    }
    group.rows.push({
      id: row.id,
      name: row.name,
      role: row.role,
      replacedName: row.replacedName,
    });
    return groups;
  }, []);
}

function fixedPackageMenuRows(
  cart: CartSummary,
  configuration: PackageConfiguration,
) {
  const configuredItems = new Map(
    configuration.categoryRules.flatMap((rule) =>
      rule.items.map((item) => [item.id, item] as const),
    ),
  );
  const swaps = new Map(
    cart.items
      .filter((item) => item.replacedMenuItemId)
      .map((item) => [item.replacedMenuItemId!, item]),
  );
  const included = configuration.categoryRules.flatMap((rule) =>
    rule.items
      .filter((item) => item.role === 'INCLUDED' && !item.swapForMenuItemId)
      .map((item) => {
        const swap = swaps.get(item.id);
        const shown = swap ? configuredItems.get(swap.menuItemId) : item;
        return {
          id: `${rule.id}-${item.id}`,
          categoryId: rule.category.id,
          categoryName: rule.category.name,
          name: shown?.name ?? item.name,
          role: swap ? 'SWAP' : 'INCLUDED',
          replacedName: swap ? item.name : undefined,
        };
      }),
  );
  const extras = cart.items
    .filter((item) => item.role === 'EXTRA')
    .map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      name: item.menuItemName,
      role: item.role,
      replacedName: item.replacedMenuItemName,
    }));
  return [...included, ...extras];
}

export default function CartPage() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const deliveryLocation = useDeliveryLocationStore((state) => state.location);
  const setDeliveryLocation = useDeliveryLocationStore(
    (state) => state.setLocation,
  );
  const markAddressesChanged = useAddressBookStore(
    (state) => state.markChanged,
  );
  const hydrate = useOrderBuilderStore((state) => state.hydrateFromCart);
  const reset = useOrderBuilderStore((state) => state.reset);

  const [cart, setCart] = useState<CartSummary>();
  const [activeCarts, setActiveCarts] = useState<CartSummary[]>([]);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [configByCartId, setConfigByCartId] = useState<Record<string, PackageConfiguration>>({});
  const [quote, setQuote] = useState<PackageSelectionPrice>();
  const [multiCartQuote, setMultiCartQuote] = useState<MultiCartQuote>();
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [cartReloadKey, setCartReloadKey] = useState(0);
  const missingCartRecoveryAttempts = useRef(0);
  const recoveringCart = useRef(false);
  const [paying, setPaying] = useState(false);
  const [deletingCartId, setDeletingCartId] = useState('');
  const [clearCartOpen, setClearCartOpen] = useState(false);
  const [clearingCart, setClearingCart] = useState(false);
  const [updatingCartId, setUpdatingCartId] = useState('');
  const [editingQuantityCartId, setEditingQuantityCartId] = useState('');
  const [error, setError] = useState('');
  const [validationLocation, setValidationLocation] = useState<'' | 'delivery' | 'contact'>('');
  const [venueStatus, setVenueStatus] = useState<VenueServiceability>('checking');
  const [specialNotes, setSpecialNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [updatingDelivery, setUpdatingDelivery] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressForm, setAddressForm] =
    useState<CartAddressForm>(emptyCartAddressForm);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    setContactNumber(session?.user.mobileNumber ?? '');
  }, [session?.user.mobileNumber]);

  function openAddressDialog() {
    setAddressError('');
    setAddressForm({
      ...emptyCartAddressForm,
      ...deliveryLocation?.address,
      latitude: deliveryLocation?.latitude ?? '',
      longitude: deliveryLocation?.longitude ?? '',
    });
    setAddressDialogOpen(true);
  }

  async function saveCartAddress(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setAddressError('');
    const result = createAddressSchema.safeParse({
      ...addressForm,
      label:
        addressForm.label.trim() ||
        ({
          HOME: 'Home',
          OFFICE: 'Office',
          EVENT_VENUE: 'Event venue',
          OTHER: 'Other',
        }[addressForm.addressType] ?? undefined),
      addressLine2: addressForm.addressLine2.trim() || undefined,
      landmark: addressForm.landmark.trim() || undefined,
      latitude: addressForm.latitude || undefined,
      longitude: addressForm.longitude || undefined,
      isDefault: false,
    });
    if (!result.success) {
      setAddressError(
        result.error.issues[0]?.message ?? 'Please check the address details.',
      );
      return;
    }
    setAddressSaving(true);
    try {
      const created = await apiRequest<UserAddress>(
        '/me/addresses',
        { method: 'POST', body: JSON.stringify(result.data) },
        session.accessToken,
      );
      markAddressesChanged();
      if (created.latitude && created.longitude) {
        const resolution = await apiRequest<LocationResolution>(
          '/operating-regions/resolve',
          {
            method: 'POST',
            body: JSON.stringify({
              latitude: created.latitude,
              longitude: created.longitude,
            }),
          },
          session.accessToken,
        );
        setDeliveryLocation({
          latitude: created.latitude,
          longitude: created.longitude,
          label:
            created.label ||
            created.addressLine2 ||
            created.addressLine1 ||
            created.city,
          source: 'saved',
          savedAddressId: created.id,
          address: {
            addressLine1: created.addressLine1,
            addressLine2: created.addressLine2 ?? undefined,
            city: created.city,
            state: created.state,
            pincode: created.pincode,
            landmark: created.landmark ?? undefined,
          },
          resolution,
        });
      }
      setAddressDialogOpen(false);
    } catch (reason) {
      setAddressError((reason as Error).message);
    } finally {
      setAddressSaving(false);
    }
  }

  const recoverMissingCart = useCallback((reason: unknown) => {
    if (!isClearedCartError(reason)) return false;
    if (missingCartRecoveryAttempts.current >= 2) {
      setError('Your cart changed. Refresh this page to continue.');
      return true;
    }
    missingCartRecoveryAttempts.current += 1;
    recoveringCart.current = true;
    setError('');
    setLoading(true);
    setQuote(undefined);
    setMultiCartQuote(undefined);
    setCartReloadKey((current) => current + 1);
    return true;
  }, []);

  useEffect(
    () => subscribeToCartCleared((source) => {
      if (source === 'storage') {
        recoverMissingCart(new Error('Active cart not found'));
      }
    }),
    [recoverMissingCart],
  );

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
        missingCartRecoveryAttempts.current = 0;
        setError(
          aggregate.valid
            ? ''
            : 'The latest quote could not be completed. Please review your delivery details.',
        );
      } catch (reason) {
        setQuote(undefined);
        setMultiCartQuote(undefined);
        if (!recoverMissingCart(reason)) setError((reason as Error).message);
      } finally {
        setQuoteLoading(false);
      }
    },
    [session, recoverMissingCart],
  );

  useEffect(() => {
    if (!session) return;
    let active = true;
    recoveringCart.current = false;
    setLoading(true);
    async function load() {
      try {
        const allCarts = await apiRequest<CartSummary[]>(
          '/cart/all',
          {},
          session!.accessToken,
        );
        if (!active) return;
        setActiveCarts(allCarts);
        publishCheckoutCartCount(allCarts.length);
        const currentCart = allCarts[0];
        if (!currentCart) {
          missingCartRecoveryAttempts.current = 0;
          reset();
          setCart(undefined);
          setConfig(undefined);
          setConfigByCartId({});
          setQuote(undefined);
          setMultiCartQuote(undefined);
          setError('');
          return;
        }
        setCart(currentCart);
        setSpecialNotes(currentCart.specialNotes ?? '');
        setContactNumber(currentCart.contactNumber || session!.user.mobileNumber);
        hydrate(currentCart);
        const configuration = await apiRequest<PackageConfiguration>(
          `/package-versions/${currentCart.packageVersionId}/configuration`,
        );
        if (!active) return;
        setConfig(configuration);
        const configurations = await Promise.all(
          allCarts.map(async (packageCart) => {
            if (packageCart.id === currentCart.id) {
              return [packageCart.id, configuration] as const;
            }
            try {
              const packageConfiguration = await apiRequest<PackageConfiguration>(
                `/package-versions/${packageCart.packageVersionId}/configuration`,
              );
              return [packageCart.id, packageConfiguration] as const;
            } catch {
              return undefined;
            }
          }),
        );
        if (active) {
          setConfigByCartId(
            Object.fromEntries(
              configurations.filter(
                (entry): entry is readonly [string, PackageConfiguration] =>
                  Boolean(entry),
              ),
            ),
          );
        }
        await loadQuote(currentCart.id);
      } catch (reason) {
        if (active && !recoverMissingCart(reason)) setError((reason as Error).message);
      } finally {
        if (active && !recoveringCart.current) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [session, hydrate, loadQuote, reset, recoverMissingCart, cartReloadKey]);

  const onEventSaved = useCallback(
    (updated: CartSummary) => {
      if (!session) return;
      setError('');
      setValidationLocation('');
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
        .catch((reason) => {
          if (!recoverMissingCart(reason)) setError((reason as Error).message);
        });
    },
    [session, hydrate, loadQuote, activeCarts, recoverMissingCart],
  );

  async function updatePackageQuantity(
    packageCart: CartSummary,
    requestedCount: number,
  ) {
    if (!session || updatingCartId) return;
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
      if (!recoverMissingCart(reason)) setError((reason as Error).message);
    } finally {
      setUpdatingCartId('');
    }
  }

  async function updateDeliveryService(
    deliveryServiceType: DeliveryServiceType,
    helperCount: number,
  ) {
    if (!session || !cart || updatingDelivery) return;
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
      if (!recoverMissingCart(reason)) setError((reason as Error).message);
    } finally {
      setUpdatingDelivery(false);
    }
  }

  async function updateCutleryExtraCount(nextCount: number) {
    if (!session || !cart || updatingDelivery) return;
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
      if (!recoverMissingCart(reason)) setError((reason as Error).message);
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
      setValidationLocation('contact');
      setError('Enter a valid 10-digit contact number to continue.');
      return;
    }
    setSavingContact(true);
    setValidationLocation('');
    setError('');
    try {
      await persistContactNumber(validated.data);
      setEditingContact(false);
    } catch (reason) {
      if (!recoverMissingCart(reason)) setError((reason as Error).message);
    } finally {
      setSavingContact(false);
    }
  }

  async function removeCart(cartId: string) {
    if (!session || deletingCartId) return;
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
      publishCheckoutCartCount(remaining.length);
      setMultiCartQuote((current) => withoutCartQuote(current, cartId));
      window.dispatchEvent(new Event('cart-updated'));
      if (!remaining.length) {
        reset();
        setCart(undefined);
        setConfig(undefined);
        setQuote(undefined);
        setMultiCartQuote(undefined);
        notifyCartCleared();
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
      if (!recoverMissingCart(reason)) setError((reason as Error).message);
    } finally {
      setDeletingCartId('');
    }
  }

  async function clearCart() {
    if (!session || clearingCart) return;
    setClearingCart(true);
    setError('');
    try {
      await apiRequest('/cart', { method: 'DELETE' }, session.accessToken);
      reset();
      setActiveCarts([]);
      publishCheckoutCartCount(0);
      setCart(undefined);
      setConfig(undefined);
      setQuote(undefined);
      setMultiCartQuote(undefined);
      setClearCartOpen(false);
      notifyCartCleared();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (reason) {
      if (!recoverMissingCart(reason)) setError((reason as Error).message);
    } finally {
      setClearingCart(false);
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

  const orderSummaries = activeCarts.map((packageCart) => {
    const packageQuote = multiCartQuote?.carts.find(
      (entry) => entry.cartId === packageCart.id,
    )?.quote;
    const packageConfiguration =
      configByCartId[packageCart.id] ??
      (packageCart.id === cart?.id ? config : undefined);
    const rows =
      packageCart.id === cart?.id
        ? reviewRows
        : packageQuote?.items.length
          ? packageQuote.items.map((item, index) => ({
              id: `${packageCart.id}-${item.menuItemId}-${index}`,
              categoryId: item.categoryId,
              categoryName: item.categoryName,
              name: item.menuItemName,
              role: item.role,
              replacedName: item.replacedMenuItemName,
            }))
          : packageCart.package.type === 'FIXED_PACKAGE' && packageConfiguration
            ? fixedPackageMenuRows(packageCart, packageConfiguration)
            : packageCart.items.map((item) => ({
                id: item.id,
                categoryId: item.categoryId,
                categoryName: item.categoryName,
                name: item.menuItemName,
                role: item.role,
                replacedName: item.replacedMenuItemName,
              }));
    const groups = sortMenuCategories(
      groupOrderItems(rows),
      (group) => group.name,
    );

    return {
      cart: packageCart,
      groups,
      itemCount: groups.reduce((count, group) => count + group.rows.length, 0),
      guestCount:
        packageQuote?.guestCount ??
        packageCart.guestCount ??
        packageCart.package.minGuestCount,
      weightKg:
        packageCart.items.reduce(
          (sum, item) => sum + (item.weightGrams ?? 0),
          0,
        ) / 1000,
    };
  });

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
    if (!session || !cart || !ready || venueStatus !== 'serviceable' || !multiCartQuote?.valid) return;
    const validatedContactNumber = mobileNumberSchema.safeParse(contactNumber);
    if (!validatedContactNumber.success) {
      setError('Enter a valid 10-digit contact number to continue.');
      return;
    }
    setError('');
    setPaying(true);
    let checkoutOrderId: string | undefined;
    try {
      await persistContactNumber(validatedContactNumber.data);
      const selectedQuote =
        multiCartQuote.carts.find((entry) => entry.cartId === cart.id)?.quote ??
        quote;
      const orders = await apiRequest<OrderSummary[]>(
        '/cart/checkout-all',
        {
          method: 'POST',
          body: JSON.stringify({ specialNotes }),
        },
        session.accessToken,
      );
      const order = orders[0];
      checkoutOrderId = order.id;
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
            setPaying(false);
            router.push(`/payment/status?orderId=${order.id}`);
          },
        },
        handler: async (response: Record<string, string>) => {
          try {
            await verifyPayment(order.id, response);
          } catch {
            setPaying(false);
            router.push(`/payment/status?orderId=${order.id}`);
          }
        },
      });
      checkout.on('payment.failed', () => {
        setPaying(false);
        router.push(`/payment/status?orderId=${order.id}`);
      });
      checkout.open();
    } catch (reason) {
      if (checkoutOrderId) {
        router.push(`/payment/status?orderId=${checkoutOrderId}`);
      } else if (!recoverMissingCart(reason)) {
        setError((reason as Error).message);
      }
      setPaying(false);
    }
  }

  function requestPayment() {
    if (venueStatus !== 'serviceable') {
      setValidationLocation('delivery');
      setError(
        venueStatus === 'outside' ||
          (venueStatus === 'missing' &&
            deliveryLocation?.resolution.reason === 'OUTSIDE_SERVICE_AREA')
          ? 'This location is outside our delivery area. Choose another address to continue.'
          : venueStatus === 'closed'
            ? 'The kitchen serving this location is currently closed. Choose another address to continue.'
            : venueStatus === 'checking'
              ? 'Checking delivery availability for this address. Please wait a moment.'
              : venueStatus === 'missing-pin'
                ? 'This address needs a map pin before we can check delivery.'
                : venueStatus === 'error'
                  ? 'We could not check delivery for this address. Select it again and retry.'
                  : 'Choose a delivery address to continue.',
      );
      document
        .getElementById('checkout-delivery')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!ready) {
      const missingAddress = activeCarts.some(
        (entry) => !entry.event?.address || !entry.event.region,
      );
      const missingDate = activeCarts.some((entry) => !entry.event?.eventDate);
      const missingTime = activeCarts.some(
        (entry) => !entry.event?.eventTimeStart,
      );
      setValidationLocation('delivery');
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
      setValidationLocation('contact');
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
    setValidationLocation('');
    void pay();
  }

  if (!session) {
    return (
      <div className="page-shell">
        <h1 className="mb-3 font-sans text-lg font-semibold leading-6 text-foreground sm:text-2xl">
          Your cart
        </h1>
        <AuthRequiredPanel
          title="Sign in to view your cart"
          description="Sign in to see your active cart and continue your order."
          returnHref="/cart"
          headingLevel={2}
        />
      </div>
    );
  }
  if (loading) {
    return (
      <main className="page-shell">
        <div className="h-80 animate-pulse rounded-2xl bg-white/60" />
      </main>
    );
  }
  if (!cart || activeCarts.length === 0) {
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
  const mobileTotal = multiCartQuote?.totalAmount;

  return (
    <main
      className="bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10"
      onFocusCapture={(event) => {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        ) {
          setKeyboardOpen(true);
        }
      }}
      onBlurCapture={() => {
        window.setTimeout(() => {
          const activeElement = document.activeElement;
          setKeyboardOpen(
            activeElement instanceof HTMLInputElement ||
              activeElement instanceof HTMLTextAreaElement,
          );
        }, 0);
      }}
    >
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />

      <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-10">
        <h1 className="mb-5 font-sans text-2xl font-semibold leading-tight text-foreground sm:mb-7 sm:text-3xl">
          Checkout
        </h1>
        <section className="mb-5 overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm sm:mb-7">
            <div className="border-b border-border/60 bg-ivory-warm/60 px-4 py-4 sm:px-6">
              <h2 className="font-sans text-lg font-semibold leading-6 text-foreground">
                Your order <span className="text-muted-foreground">({activeCarts.length})</span>
              </h2>
            </div>
            <div className="divide-y divide-border/60 px-4 sm:px-6">
              {orderSummaries.map(({ cart: packageCart, itemCount, guestCount, weightKg }) => {
                const packageQuote = multiCartQuote?.carts.find(
                  (entry) => entry.cartId === packageCart.id,
                )?.quote;
                const menuHref =
                  packageCart.package.type === 'ORDER_BY_KG'
                    ? `/order-by-kg?packageVersionId=${packageCart.packageVersionId}&cartId=${packageCart.id}`
                    : packageCart.package.type === 'CUSTOM_PACKAGE'
                      ? `/packages/build?packageVersionId=${packageCart.packageVersionId}&cartId=${packageCart.id}`
                      : `/menu/select?packageVersionId=${packageCart.packageVersionId}&cartId=${packageCart.id}`;
                const menuSummary = itemCount > 0
                  ? `${itemCount} ${itemCount === 1 ? 'dish' : 'dishes'}`
                  : packageCart.package.type === 'FIXED_PACKAGE'
                    ? 'Included menu'
                    : 'No dishes selected';
                return (
                  <article key={packageCart.id} className="min-w-0 py-4 sm:py-5">
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <h3 className="min-w-0 flex-1 break-words font-sans text-base font-semibold leading-6 text-foreground">
                        {packageCart.package.name}
                      </h3>
                      <strong className="money-text shrink-0 text-base font-semibold text-foreground">
                        {packageQuote
                          ? formatCheckoutCurrency(packageQuote.subtotalAmount)
                          : quoteLoading ? 'Updating' : ''}
                      </strong>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {packageCart.package.type === 'ORDER_BY_KG'
                        ? `${weightKg} kg · ${menuSummary}`
                        : `${guestCount} ${packageCart.package.type === 'MEAL_BOX' ? 'boxes' : 'guests'} · ${menuSummary}`}
                    </p>
                    <div className="mt-2 flex min-h-9 flex-wrap items-center gap-x-5 gap-y-1">
                      <Link
                        href={menuHref}
                        className="inline-flex min-h-9 items-center text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Edit menu
                      </Link>
                      {packageCart.package.type !== 'ORDER_BY_KG' && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuantityCartId((current) =>
                              current === packageCart.id ? '' : packageCart.id,
                            )
                          }
                          className="inline-flex min-h-9 items-center text-sm font-medium text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {editingQuantityCartId === packageCart.id
                            ? 'Done'
                            : `Change ${packageCart.package.type === 'MEAL_BOX' ? 'boxes' : 'guests'}`}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${packageCart.package.name} from cart`}
                        disabled={Boolean(deletingCartId)}
                        onClick={() => void removeCart(packageCart.id)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    {editingQuantityCartId === packageCart.id &&
                      packageCart.package.type !== 'ORDER_BY_KG' && (
                        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            {packageCart.package.type === 'MEAL_BOX' ? 'Box count' : 'Guest count'}
                          </span>
                          <div className="flex h-10 items-center overflow-hidden rounded-md border bg-white">
                            <button
                              type="button"
                              aria-label={`Decrease count for ${packageCart.package.name}`}
                              disabled={Boolean(updatingCartId) || guestCount <= packageCart.package.minGuestCount}
                              onClick={() => void updatePackageQuantity(packageCart, guestCount - 1)}
                              className="grid h-10 w-10 place-items-center text-primary disabled:opacity-30"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              aria-label={`Count for ${packageCart.package.name}`}
                              inputMode="numeric"
                              defaultValue={guestCount}
                              key={`${packageCart.id}-${guestCount}`}
                              onBlur={(event) => {
                                const next = clampPackageQuantity(packageCart, Number(event.target.value));
                                event.currentTarget.value = String(next);
                                void updatePackageQuantity(packageCart, next);
                              }}
                              className="h-10 w-14 border-x text-center text-sm font-bold outline-none"
                            />
                            <button
                              type="button"
                              aria-label={`Increase count for ${packageCart.package.name}`}
                              disabled={Boolean(updatingCartId) || Boolean(packageCart.package.maxGuestCount && guestCount >= packageCart.package.maxGuestCount)}
                              onClick={() => void updatePackageQuantity(packageCart, guestCount + 1)}
                              className="grid h-10 w-10 place-items-center text-primary disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                  </article>
                );
              })}
            </div>
            <Link
              href="/packages"
              className="inline-flex min-h-12 items-center px-4 text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-6"
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Add another package
            </Link>
          </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-5">
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
                  onAddAddress={openAddressDialog}
                  onVenueStatusChange={setVenueStatus}
                  onMissingCart={() =>
                    recoverMissingCart(new Error('Active cart not found'))
                  }
                />
                {validationLocation === 'delivery' && error && (
                  <p role="alert" className="mt-1 text-sm font-medium text-red-800">
                    {error}
                  </p>
                )}

              <section
                id="checkout-contact"
                className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-6"
              >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-sans text-base font-semibold leading-5 text-foreground">Contact</h2>
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
                        onChange={(event) => {
                          setContactNumber(
                            event.target.value.replace(/\D/g, '').slice(0, 10),
                          );
                          setError('');
                          setValidationLocation('');
                        }}
                        maxLength={10}
                        placeholder="9876543210"
                        required
                        className="min-h-11 rounded-none border-0 focus-visible:ring-0"
                      />
                    </div>
                  )}
                  {validationLocation === 'contact' && error && (
                    <p role="alert" className="mt-2 text-sm font-medium text-red-800">
                      {error}
                    </p>
                  )}
                <div className="mt-4 border-t border-border/60 pt-4">
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
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <section className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-sans text-base font-semibold leading-5 text-foreground">
                    Price breakdown
                  </h2>
                </div>
              </div>
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
                  {error && !validationLocation && (
                    <p
                      role="alert"
                      className="mt-3 text-sm font-medium text-red-800"
                    >
                      {error}
                    </p>
                  )}
                  <div className="hidden lg:block">
                    <Button
                      className="mt-5 h-12 w-full"
                      onClick={requestPayment}
                      disabled={quoteLoading || paying}
                    >
                      {paying ? 'Opening payment…' : 'Continue'}
                    </Button>
                    <p className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                      <LockKeyhole className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Secure payment
                    </p>
                  </div>
                </div>
            </section>
          </aside>
        </div>

        {addressDialogOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-end bg-slate-950/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-address-title"
          >
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close address form"
              onClick={() => setAddressDialogOpen(false)}
            />
            <form
              onSubmit={saveCartAddress}
              className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2
                      id="cart-address-title"
                      className="font-sans text-xl font-semibold text-foreground"
                    >
                      Complete delivery address
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddressDialogOpen(false)}
                  className="min-h-10 shrink-0 px-2 text-sm font-semibold text-primary"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field label="Address type">
                  <Select
                    value={addressForm.addressType}
                    onChange={(event) => {
                      const addressType = event.target.value as AddressType;
                      setAddressForm((current) => ({
                        ...current,
                        addressType,
                        label:
                          addressType === 'OTHER'
                            ? ''
                            : current.label ||
                              (addressType === 'OFFICE'
                                ? 'Office'
                                : addressType === 'EVENT_VENUE'
                                  ? 'Event venue'
                                  : 'Home'),
                      }));
                    }}
                  >
                    <option value="HOME">Home</option>
                    <option value="OFFICE">Work</option>
                    <option value="EVENT_VENUE">Event venue</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </Field>
                <Field label="Address label" optional>
                  <Input
                    value={addressForm.label}
                    maxLength={50}
                    placeholder="e.g. Home or event venue"
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="House, building or street" className="sm:col-span-2">
                  <Input
                    value={addressForm.addressLine1}
                    maxLength={255}
                    required
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        addressLine1: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Area / locality" optional>
                  <Input
                    value={addressForm.addressLine2}
                    maxLength={255}
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        addressLine2: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Landmark" optional>
                  <Input
                    value={addressForm.landmark}
                    maxLength={255}
                    placeholder="Nearby landmark"
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        landmark: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={addressForm.city}
                    maxLength={100}
                    required
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="State">
                  <Input
                    value={addressForm.state}
                    maxLength={100}
                    required
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        state: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Pincode" className="sm:col-span-2">
                  <Input
                    value={addressForm.pincode}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        pincode: event.target.value.replace(/\D/g, ''),
                      }))
                    }
                  />
                </Field>
              </div>
              {addressError && (
                <p role="alert" className="mt-4 text-sm font-medium text-red-800">
                  {addressError}
                </p>
              )}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddressDialogOpen(false)}
                  disabled={addressSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addressSaving}>
                  {addressSaving ? 'Saving address…' : 'Save and use address'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {clearCartOpen && (
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

      {!keyboardOpen && <MobileOrderBar checkout label="Checkout total and continue">
        <div className="mobile-order-bar-row">
          <div className="mobile-order-bar-summary">
            <span className="mobile-order-bar-label">Payable total</span>
            <strong className="mobile-order-bar-total">
              {mobileTotal != null
                ? formatCheckoutCurrency(mobileTotal)
                : quoteLoading
                  ? 'Updating…'
                  : 'Add event details'}
            </strong>
          </div>
          <Button
            className="mobile-order-bar-action"
            onClick={requestPayment}
            disabled={quoteLoading || paying}
          >
            {paying ? 'Opening…' : 'Continue'}
          </Button>
        </div>
      </MobileOrderBar>}
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
      <details className="group rounded-xl bg-ivory/60 px-3 sm:px-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span className="group-open:hidden">View breakdown</span>
          <span className="hidden group-open:inline">Hide breakdown</span>
          <span aria-hidden="true" className="text-lg leading-none">{`+`}</span>
        </summary>
        <div className="space-y-3 border-t border-border/60 py-4 text-sm">
          {aggregate.carts.map(({ cartId, quote }) => {
            const packageCart = cartById.get(cartId);
            return (
              <PriceLine
                key={cartId}
                label={packageCart?.package.name ?? quote.packageName}
                value={formatCheckoutCurrency(quote.subtotalAmount)}
              />
            );
          })}
          <PriceLine
            label={deliveryLabel}
            value={formatCheckoutCurrency(aggregate.deliveryFee)}
          />
          {extraCutleryCount > 0 && (
            <PriceLine
              label={`Extra cutlery · ${extraCutleryCount} ${extraCutleryCount === 1 ? 'set' : 'sets'}`}
              value={formatCheckoutCurrency(cutleryTotal)}
            />
          )}
          <PriceLine
            label="Final total"
            value={formatCheckoutCurrency(aggregate.totalAmount)}
          />
        </div>
      </details>
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
        <span className="text-base font-semibold">Total</span>
        <strong className="money-text text-xl font-bold text-primary">
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
    <section className="mt-5 rounded-xl border border-border/70 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Utensils className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Cutlery</h3>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {includedCount} included
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Plate + Spoon · Extra {formatCurrency(unitPrice).replace(/\.00$/, '')}/set
      </p>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
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
    <section className="mt-5">
      <h3 className="mb-3 font-sans text-base font-semibold leading-5 text-foreground">
        How should we deliver
      </h3>
      <div
        className="grid gap-2.5"
        role="radiogroup"
        aria-label="Delivery service"
      >
        {options.map(({ type, title, description, addon, icon: Icon }) => {
          const isSelected = selected === type;
          const total = baseDelivery + addon;
          const priceLabel =
            addon === 0
              ? quote
                ? formatCurrency(total).replace(/\.00$/, '')
                : '—'
              : `+${formatCurrency(addon).replace(/\.00$/, '')}`;
          return (
            <div
              key={type}
              className={cn(
                'overflow-hidden rounded-xl border transition-colors',
                isSelected
                  ? 'border-primary/40 bg-primary/[0.055]'
                  : 'border-border/70 bg-white/85 hover:border-primary/25',
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
                className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
              >
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                    isSelected
                      ? 'border-primary bg-primary text-white'
                      : 'border-muted-foreground/60 bg-white',
                  )}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold leading-5 text-foreground">
                    {title}
                  </strong>
                  <span className="block text-xs leading-4 text-muted-foreground">
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
                <div className="flex items-center justify-between border-t border-primary/15 bg-white/50 px-3 py-2 pl-12">
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
