'use client';
import { MobileOrderBar } from '../../components/mobile-order-bar';

import type {
  CartSummary,
  CutleryItem,
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
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
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
  X,
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RetryPaymentButton } from '../../components/retry-payment-button';
import { DataImage } from '../../components/data-image';
import {
  AddressMapPicker,
  type MapAddress,
} from '../../components/address-map-picker';
import { AddressDetailsFields } from '../../components/address-details-fields';
import { SelectionContextPanel } from '../../components/selection-context-panel';
import type {
  CheckoutFieldState,
  VenueServiceability,
} from '../../components/selection-context-panel';
import { Button } from '../../components/ui/button';
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

type CheckoutValidationIssue =
  | 'address'
  | 'coordinates'
  | 'outside'
  | 'closed'
  | 'checking'
  | 'availability'
  | 'date'
  | 'time'
  | 'contact'
  | 'quote'
  | 'payment'
  | 'details';

function deliveryFieldForIssue(
  issue?: CheckoutValidationIssue,
): 'address' | 'date' | 'time' | undefined {
  if (
    issue === 'address' ||
    issue === 'coordinates' ||
    issue === 'outside' ||
    issue === 'closed' ||
    issue === 'availability'
  )
    return 'address';
  if (issue === 'date' || issue === 'time') return issue;
  return undefined;
}

const checkoutIssueTitles: Record<CheckoutValidationIssue, string> = {
  address: 'Delivery address required',
  coordinates: 'Map location required',
  outside: 'Outside our delivery area',
  closed: 'Delivery is unavailable here',
  checking: 'Checking delivery availability',
  availability: 'Unable to confirm delivery',
  date: 'Delivery date required',
  time: 'Delivery time required',
  contact: 'Valid contact number required',
  quote: 'Unable to calculate the total',
  payment: 'Payment needs attention',
  details: 'Complete the required details',
};

function friendlyCheckoutError(reason: unknown) {
  const raw = reason instanceof Error ? reason.message : String(reason ?? '');
  const rules: Array<[RegExp, string]> = [
    [
      /outside.{0,30}(service|delivery)|not.{0,20}serviceable|service.{0,20}area/i,
      'This location is outside our delivery area. Choose another address to continue.',
    ],
    [
      /latitude|longitude|coordinates?|map\s*pin/i,
      'This address needs a map pin. Search for the venue or select its location on the map.',
    ],
    [
      /kitchen.{0,30}(closed|inactive|unavailable)|delivery.{0,20}closed/i,
      'The kitchen serving this location is currently closed. Choose another address to continue.',
    ],
    [
      /event.{0,15}date|delivery.{0,15}date|date.{0,15}required/i,
      'Choose a delivery date to continue.',
    ],
    [
      /event.{0,15}time|delivery.{0,15}time|time.{0,15}(required|slot|unavailable)/i,
      'Choose an available delivery time to continue.',
    ],
    [
      /phone|mobile|contact.{0,15}(required|invalid)/i,
      'Enter a valid 10-digit contact number to continue.',
    ],
    [
      /quote|price.{0,15}(changed|unavailable)|total.{0,15}calculate/i,
      'We could not calculate the latest total. Review the delivery details and try again.',
    ],
  ];
  return (
    rules.find(([pattern]) => pattern.test(raw))?.[1] ||
    raw ||
    'Something went wrong. Review the order details and try again.'
  );
}

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

const CUTLERY_PREVIEW_ITEMS: CutleryItem[] = [
  {
    id: 'cutlery-plates',
    name: 'Plates',
    extraLabel: 'Extra Plates',
    unitLabel: 'piece',
    unitPrice: '10.00',
    includedQuantity: 10,
    imageUrl: '/cutlery/plates.png',
    displayOrder: 20,
    isActive: true,
    quantity: 0,
    lineTotal: '0.00',
  },
  {
    id: 'cutlery-spoons-forks',
    name: 'Spoons & Forks',
    extraLabel: 'Extra Spoons & Forks',
    unitLabel: 'set',
    unitPrice: '5.00',
    includedQuantity: 10,
    imageUrl: '/cutlery/spoons-forks.png',
    displayOrder: 40,
    isActive: true,
    quantity: 0,
    lineTotal: '0.00',
  },
  {
    id: 'cutlery-tissues',
    name: 'Tissues',
    extraLabel: 'Extra Tissues',
    unitLabel: 'pack',
    unitPrice: '5.00',
    includedQuantity: 10,
    imageUrl: '/cutlery/tissues.png',
    displayOrder: 50,
    isActive: true,
    quantity: 0,
    lineTotal: '0.00',
  },
  {
    id: 'cutlery-serving-spoons',
    name: 'Serving Spoons',
    extraLabel: 'Serving Spoons',
    unitLabel: 'piece',
    unitPrice: '20.00',
    includedQuantity: 0,
    imageUrl: '/cutlery/serving-spoons.png',
    displayOrder: 10,
    isActive: true,
    quantity: 0,
    lineTotal: '0.00',
  },
  {
    id: 'cutlery-water-bottles',
    name: 'Water Bottles',
    extraLabel: 'Water Bottles',
    unitLabel: 'piece',
    unitPrice: '10.00',
    includedQuantity: 0,
    imageUrl: '/cutlery/water-bottles.png',
    displayOrder: 30,
    isActive: true,
    quantity: 0,
    lineTotal: '0.00',
  },
];

export default function CartPage() {
  const router = useRouter();
  const [previewCutlery, setPreviewCutlery] = useState(false);
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
  const [configByCartId, setConfigByCartId] = useState<
    Record<string, PackageConfiguration>
  >({});
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
  const [cartReloadKey, setCartReloadKey] = useState(0);
  const missingCartRecoveryAttempts = useRef(0);
  const recoveringCart = useRef(false);
  const [paying, setPaying] = useState(false);
  const paymentWindowHandled = useRef(false);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [paymentNeedsReview, setPaymentNeedsReview] = useState(false);
  const [deletingCartId, setDeletingCartId] = useState('');
  const [clearCartOpen, setClearCartOpen] = useState(false);
  const [clearingCart, setClearingCart] = useState(false);
  const [updatingCartId, setUpdatingCartId] = useState('');
  const [editingQuantityCartId, setEditingQuantityCartId] = useState('');
  const [error, setError] = useState('');
  const [validationIssue, setValidationIssue] =
    useState<CheckoutValidationIssue>();
  const [venueStatus, setVenueStatus] =
    useState<VenueServiceability>('checking');
  const [checkoutFields, setCheckoutFields] = useState<CheckoutFieldState>({
    hasAddress: false,
    hasCoordinates: false,
    hasDate: false,
    hasTime: false,
    saving: true,
  });
  const [eventSyncing, setEventSyncing] = useState(false);
  const eventSyncVersion = useRef(0);
  const [specialNotes, setSpecialNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [updatingDelivery, setUpdatingDelivery] = useState(false);
  const [updatingCutlery, setUpdatingCutlery] = useState(false);
  const [cutleryPending, setCutleryPending] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressForm, setAddressForm] =
    useState<CartAddressForm>(emptyCartAddressForm);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState('');
  const inlineDeliveryField = deliveryFieldForIssue(validationIssue);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      setPreviewCutlery(
        new URLSearchParams(window.location.search).get('preview') ===
          'cutlery',
      );
    }
  }, []);

  const clearCartViewState = useCallback(() => {
    reset();
    setActiveCarts([]);
    setCart(undefined);
    setConfig(undefined);
    setConfigByCartId({});
    setQuote(undefined);
    setMultiCartQuote(undefined);
    setPendingOrder(undefined);
    setPendingBatch(undefined);
    setSpecialNotes('');
    setNotesExpanded(false);
    setEditingQuantityCartId('');
    setClearCartOpen(false);
    setValidationIssue(undefined);
    setPaymentNotice('');
    setPaymentNeedsReview(false);
    setPaying(false);
  }, [reset]);

  useEffect(() => {
    if (!validationIssue) return;
    const resolved =
      (validationIssue === 'address' && checkoutFields.hasAddress) ||
      (validationIssue === 'coordinates' && checkoutFields.hasCoordinates) ||
      (validationIssue === 'date' && checkoutFields.hasDate) ||
      (validationIssue === 'time' && checkoutFields.hasTime) ||
      ((validationIssue === 'outside' ||
        validationIssue === 'closed' ||
        validationIssue === 'availability') &&
        venueStatus === 'serviceable') ||
      (validationIssue === 'checking' &&
        !checkoutFields.saving &&
        !eventSyncing &&
        !quoteLoading &&
        venueStatus !== 'checking');
    if (!resolved) return;
    setValidationIssue(undefined);
    setError('');
  }, [
    checkoutFields,
    eventSyncing,
    quoteLoading,
    validationIssue,
    venueStatus,
  ]);

  useEffect(() => {
    setContactNumber(session?.user.mobileNumber ?? '');
  }, [session?.user.mobileNumber]);

  useEffect(() => {
    if (!paymentNotice) return;
    const timeout = window.setTimeout(() => setPaymentNotice(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [paymentNotice]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get('payment');
    if (paymentResult !== 'failed' && paymentResult !== 'cancelled') return;
    setValidationIssue('payment');
    setError(
      paymentResult === 'cancelled'
        ? 'Payment was cancelled. Your order is saved and ready to retry.'
        : 'Payment was not completed. Your order is saved and you can retry safely.',
    );
    window.history.replaceState({}, '', '/cart');
  }, []);

  function openAddressDialog() {
    setAddressError('');
    setAddressForm({
      ...emptyCartAddressForm,
      ...deliveryLocation?.address,
      addressLine2: deliveryLocation?.address?.addressLine2 ?? '',
      landmark: deliveryLocation?.address?.landmark ?? '',
      latitude: deliveryLocation?.latitude ?? '',
      longitude: deliveryLocation?.longitude ?? '',
    });
    setAddressDialogOpen(true);
  }

  function useMappedAddress(address: MapAddress) {
    setAddressForm((current) => ({
      ...current,
      addressLine1: address.addressLine1 || current.addressLine1,
      addressLine2: address.addressLine2 || current.addressLine2,
      city: address.city || current.city,
      state: address.state || current.state,
      pincode: address.pincode || current.pincode,
      landmark: address.landmark || current.landmark,
      latitude: address.latitude,
      longitude: address.longitude,
    }));
    setAddressError('');
  }

  async function saveCartAddress(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setAddressError('');
    const latitude = Number(addressForm.latitude);
    const longitude = Number(addressForm.longitude);
    if (
      !addressForm.latitude.trim() ||
      !addressForm.longitude.trim() ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setAddressError(
        'Search for the venue or select a point on the map before saving.',
      );
      return;
    }
    const result = createAddressSchema.safeParse({
      ...addressForm,
      label:
        addressForm.label.trim() ||
        ({
          HOME: 'Home',
          OFFICE: 'Office',
          EVENT_VENUE: 'Event venue',
          OTHER: 'Other',
        }[addressForm.addressType] ??
          undefined),
      addressLine2: addressForm.addressLine2.trim() || undefined,
      landmark: addressForm.landmark.trim() || undefined,
      latitude: addressForm.latitude,
      longitude: addressForm.longitude,
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
        try {
          const resolution = await apiRequest<LocationResolution>(
            '/operating-regions/resolve',
            {
              method: 'POST',
              body: JSON.stringify({
                latitude: created.latitude,
                longitude: created.longitude,
              }),
            },
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
        } catch {
          // The address is already saved. The checkout panel will retry the
          // serviceability check when it refreshes the saved address list.
        }
      }
      setAddressForm(emptyCartAddressForm);
      setAddressError('');
      setError('');
      setValidationIssue(undefined);
      setAddressDialogOpen(false);
    } catch (reason) {
      setAddressError((reason as Error).message);
    } finally {
      setAddressSaving(false);
    }
  }

  const recoverMissingCart = useCallback(
    (reason: unknown) => {
      if (!isClearedCartError(reason)) return false;
      if (missingCartRecoveryAttempts.current >= 2) {
        setError('Your cart changed. Refresh this page to continue.');
        return true;
      }
      missingCartRecoveryAttempts.current += 1;
      recoveringCart.current = true;
      clearCartViewState();
      setError('');
      setLoading(true);
      setCartReloadKey((current) => current + 1);
      return true;
    },
    [clearCartViewState],
  );

  useEffect(
    () =>
      subscribeToCartCleared((source) => {
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
        if (!recoverMissingCart(reason))
          setError(friendlyCheckoutError(reason));
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
        const [value, allCarts] = await Promise.all([
          apiRequest<CartSummary | null>('/cart', {}, session!.accessToken),
          apiRequest<CartSummary[]>('/cart/all', {}, session!.accessToken),
        ]);
        if (!active) return;
        setActiveCarts(allCarts);
        publishCheckoutCartCount(allCarts.length);
        const currentCart =
          allCarts.find((entry) => entry.id === value?.id) ??
          allCarts[0] ??
          (value?.pendingOrderId ? value : undefined);
        if (!currentCart) {
          missingCartRecoveryAttempts.current = 0;
          clearCartViewState();
          return;
        }
        setCart(currentCart);
        setPendingOrder(undefined);
        setPendingBatch(undefined);
        setSpecialNotes(currentCart.specialNotes ?? '');
        setContactNumber(
          currentCart.contactNumber || session!.user.mobileNumber,
        );
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
              const packageConfiguration =
                await apiRequest<PackageConfiguration>(
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
        if (currentCart.pendingOrderId) {
          const order = await apiRequest<OrderSummary>(
            `/orders/${currentCart.pendingOrderId}`,
            {},
            session!.accessToken,
          );
          const batch = await apiRequest<{
            orderCount: number;
            orderIds: string[];
            totalAmount: string;
          }>(
            `/orders/${currentCart.pendingOrderId}/payment-batch`,
            {},
            session!.accessToken,
          );
          if (active) {
            missingCartRecoveryAttempts.current = 0;
            setPendingOrder(order);
            setPendingBatch(batch);
          }
        } else {
          await loadQuote(currentCart.id);
        }
      } catch (reason) {
        if (active && !recoverMissingCart(reason))
          setError(friendlyCheckoutError(reason));
      } finally {
        if (active && !recoveringCart.current) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [
    session,
    hydrate,
    loadQuote,
    recoverMissingCart,
    clearCartViewState,
    cartReloadKey,
  ]);

  const onEventSaved = useCallback(
    (updated: CartSummary) => {
      if (!session) return;
      const syncVersion = ++eventSyncVersion.current;
      setEventSyncing(true);
      setError('');
      setValidationIssue(undefined);
      setCart(updated);
      setActiveCarts((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      hydrate(updated);
      const event = updated.event;
      const addressId = event?.address?.id ?? updated.address?.id;
      const regionId = event?.region?.id ?? updated.region?.id;
      if (!addressId || !regionId) {
        if (syncVersion === eventSyncVersion.current) setEventSyncing(false);
        return;
      }
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
          if (!recoverMissingCart(reason))
            setError(friendlyCheckoutError(reason));
        })
        .finally(() => {
          if (syncVersion === eventSyncVersion.current) setEventSyncing(false);
        });
    },
    [session, hydrate, loadQuote, activeCarts, recoverMissingCart],
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
      if (!recoverMissingCart(reason)) setError(friendlyCheckoutError(reason));
    } finally {
      setUpdatingCartId('');
    }
  }

  async function updateDeliveryService(
    deliveryServiceType: DeliveryServiceType,
    helperCount: number,
  ) {
    if (
      !session ||
      !cart ||
      updatingDelivery ||
      updatingCutlery ||
      cutleryPending ||
      pendingOrder
    )
      return;
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
      if (!recoverMissingCart(reason)) setError(friendlyCheckoutError(reason));
    } finally {
      setUpdatingDelivery(false);
    }
  }

  async function updateCutleryItems(
    items: Array<{ itemId: string; quantity: number }>,
  ) {
    if (
      !session ||
      !cart ||
      updatingDelivery ||
      updatingCutlery ||
      pendingOrder
    )
      return;
    setUpdatingCutlery(true);
    setError('');
    try {
      await Promise.all(
        activeCarts.map((packageCart) =>
          apiRequest<CutleryItem[]>(
            `/cart/${packageCart.id}/cutlery`,
            {
              method: 'PUT',
              body: JSON.stringify({ items }),
            },
            session.accessToken,
          ),
        ),
      );
      const updatedCarts = await apiRequest<CartSummary[]>(
        '/cart/all',
        {},
        session.accessToken,
      );
      setActiveCarts(updatedCarts);
      const updated = updatedCarts.find((entry) => entry.id === cart.id);
      if (updated) {
        setCart(updated);
        hydrate(updated);
      }
      await loadQuote(cart.id);
    } catch (reason) {
      if (!recoverMissingCart(reason)) setError(friendlyCheckoutError(reason));
    } finally {
      setUpdatingCutlery(false);
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
      setValidationIssue('contact');
      setError('Enter a valid 10-digit contact number to continue.');
      return;
    }
    setSavingContact(true);
    setValidationIssue(undefined);
    setError('');
    try {
      await persistContactNumber(validated.data);
      setEditingContact(false);
    } catch (reason) {
      if (!recoverMissingCart(reason)) setError(friendlyCheckoutError(reason));
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
      publishCheckoutCartCount(remaining.length);
      setMultiCartQuote((current) => withoutCartQuote(current, cartId));
      window.dispatchEvent(new Event('cart-updated'));
      if (!remaining.length) {
        clearCartViewState();
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
      if (!recoverMissingCart(reason)) setError(friendlyCheckoutError(reason));
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
      clearCartViewState();
      publishCheckoutCartCount(0);
      notifyCartCleared();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (reason) {
      if (!recoverMissingCart(reason)) setError(friendlyCheckoutError(reason));
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

  async function verifyPayment(response: Record<string, string>) {
    const verified = await apiRequest<{
      success: boolean;
      orderId?: string;
      needsReview?: boolean;
    }>(
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
    if (!verified.success || !verified.orderId) {
      setPaymentNeedsReview(true);
      setValidationIssue('payment');
      setError(
        'Payment was received but needs manual confirmation. Do not retry payment; please contact support.',
      );
      setPaying(false);
      return;
    }
    reset();
    notifyCartCleared();
    router.push(`/payment/status?orderId=${verified.orderId}&status=success`);
  }

  async function pay() {
    if (
      !session ||
      !cart ||
      !ready ||
      venueStatus !== 'serviceable' ||
      !multiCartQuote?.valid
    )
      return;
    const validatedContactNumber = mobileNumberSchema.safeParse(contactNumber);
    if (!validatedContactNumber.success) {
      setValidationIssue('contact');
      setError('Enter a valid 10-digit contact number to continue.');
      return;
    }
    setValidationIssue(undefined);
    setError('');
    setPaymentNotice('');
    paymentWindowHandled.current = false;
    setPaying(true);
    try {
      await persistContactNumber(validatedContactNumber.data);
      const selectedQuote =
        multiCartQuote.carts.find((entry) => entry.cartId === cart.id)?.quote ??
        quote;
      const gateway = await apiRequest<GatewayOrder>(
        '/payments/razorpay/cart-order',
        {
          method: 'POST',
          body: JSON.stringify({ specialNotes }),
        },
        session.accessToken,
      );

      if (gateway.localMode) {
        await verifyPayment({
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
          activeCarts.length === 1
            ? cart.package.type === 'ORDER_BY_KG'
              ? `${cart.package.name} · ${cart.items.reduce((sum, item) => sum + (item.weightGrams ?? 0), 0) / 1000} kg`
              : `${cart.package.name} for ${selectedQuote?.guestCount ?? cart.guestCount ?? cart.package.minGuestCount} guests`
            : `${activeCarts.length} packages in one checkout`,
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
            if (paymentWindowHandled.current) return;
            setPaymentNotice("Payment couldn't be completed, please retry.");
            setPaying(false);
          },
        },
        handler: async (response: Record<string, string>) => {
          paymentWindowHandled.current = true;
          try {
            await verifyPayment(response);
          } catch (reason) {
            setValidationIssue('payment');
            setError(friendlyCheckoutError(reason));
            if (String(reason).includes('Payment captured'))
              setPaymentNeedsReview(true);
            setPaying(false);
          }
        },
      });
      checkout.on('payment.failed', (response) => {
        paymentWindowHandled.current = true;
        setValidationIssue('payment');
        setError(
          response?.error?.description ||
            'Payment failed. Your cart is saved; retry here once the payment status is confirmed.',
        );
        setPaying(false);
      });
      checkout.open();
    } catch (reason) {
      if (!recoverMissingCart(reason)) {
        setValidationIssue('payment');
        setError(friendlyCheckoutError(reason));
        if (String(reason).includes('Payment captured'))
          setPaymentNeedsReview(true);
      }
      setPaying(false);
    }
  }

  function requestPayment() {
    const showDeliveryIssue = (
      issue: CheckoutValidationIssue,
      message: string,
    ) => {
      setValidationIssue(issue);
      setError(message);
      document
        .getElementById('checkout-delivery')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    if (!checkoutFields.hasAddress || venueStatus === 'missing') {
      showDeliveryIssue(
        'address',
        'Choose or add a complete delivery address to continue.',
      );
      return;
    }

    if (!checkoutFields.hasCoordinates || venueStatus === 'missing-pin') {
      showDeliveryIssue(
        'coordinates',
        'This address needs a map pin. Search for the venue or select its location on the map.',
      );
      return;
    }

    if (!checkoutFields.hasDate) {
      showDeliveryIssue('date', 'Choose a delivery date to continue.');
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(
            '#checkout-delivery [aria-label="Choose delivery date"]',
          )
          ?.focus();
      }, 250);
      return;
    }

    if (!checkoutFields.hasTime) {
      showDeliveryIssue(
        'time',
        'Choose an available delivery time to continue.',
      );
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(
            '#checkout-delivery [aria-label="Choose delivery time"]',
          )
          ?.focus();
      }, 250);
      return;
    }

    if (venueStatus !== 'serviceable') {
      const isOutside =
        venueStatus === 'outside' ||
        deliveryLocation?.resolution.reason === 'OUTSIDE_SERVICE_AREA';
      showDeliveryIssue(
        isOutside
          ? 'outside'
          : venueStatus === 'closed'
            ? 'closed'
            : venueStatus === 'checking'
              ? 'checking'
              : 'availability',
        isOutside
          ? 'This location is outside our delivery area. Choose another address to continue.'
          : venueStatus === 'closed'
            ? 'The kitchen serving this location is currently closed. Choose another address to continue.'
            : venueStatus === 'checking'
              ? 'We are checking delivery availability for this address. Please wait a moment and try again.'
              : 'We could not confirm delivery for this address. Select the address again or choose another one.',
      );
      return;
    }

    if (checkoutFields.saving || eventSyncing || !ready) {
      showDeliveryIssue(
        'checking',
        'Your address, date, and time are still being saved. Please wait a moment and try again.',
      );
      return;
    }

    if (quoteLoading || updatingCutlery || cutleryPending) {
      showDeliveryIssue(
        'checking',
        'Your latest delivery total is still updating. Please wait a moment.',
      );
      return;
    }
    if (!multiCartQuote?.valid) {
      showDeliveryIssue(
        'quote',
        'We could not calculate the latest total. Review the delivery details and try again.',
      );
      return;
    }
    if (!mobileNumberSchema.safeParse(contactNumber).success) {
      setEditingContact(true);
      setValidationIssue('contact');
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
    setValidationIssue(undefined);
    setError('');
    void pay();
  }

  if (previewCutlery) {
    return (
      <main className="min-h-screen bg-[#f5f1ea] p-4 sm:p-10">
        <div className="mx-auto max-w-3xl">
          <CutleryOptions
            cart={{ cutleryItems: CUTLERY_PREVIEW_ITEMS } as CartSummary}
            quote={
              {
                cutleryItems: CUTLERY_PREVIEW_ITEMS,
                cutleryTotal: '0.00',
              } as PackageSelectionPrice
            }
            disabled={false}
            onChange={async () => undefined}
            defaultOpen
          />
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <div className="page-shell">
        <h1 className="mb-3 font-serif text-lg font-semibold leading-6 text-foreground sm:text-2xl">
          Checkout
        </h1>
        <AuthRequiredPanel
          title="Sign in to resume your order"
          description="Your menu is saved. Sign in to add event details and continue to payment."
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
  if (!cart || (activeCarts.length === 0 && !pendingOrder)) {
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
  const mobileTotal = pendingOrder
    ? (pendingBatch?.totalAmount ?? pendingOrder.totalAmount)
    : multiCartQuote?.totalAmount;
  const paymentError =
    validationIssue === 'payment' && error && !paying ? error : '';
  const startRetryPayment = () => {
    setValidationIssue(undefined);
    setError('');
  };
  const reportRetryFailure = (message: string) => {
    setValidationIssue('payment');
    setError(message);
  };

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/.07),transparent_30%),linear-gradient(to_bottom,hsl(var(--ivory)),hsl(var(--background))_18rem)] pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12"
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

      {paymentNotice && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900 shadow-lg lg:bottom-6"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{paymentNotice}</span>
          <button
            type="button"
            onClick={() => setPaymentNotice('')}
            aria-label="Dismiss payment error"
            className="rounded-full p-1 hover:bg-red-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="relative isolate overflow-hidden border-b bg-hero-end text-white">
        <img
          src="/packages-hero-plated.png"
          alt="A curated catering spread ready for checkout"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--hero-end)/0.99)_0%,hsl(var(--hero-start)/0.94)_40%,hsl(var(--hero-start)/0.32)_72%,rgba(0,0,0,0.08)_100%)]" />
        <div className="container-pad flex min-h-[138px] items-center py-4 sm:min-h-[300px] sm:py-7 lg:min-h-[330px] lg:px-16 lg:py-9">
          <div className="max-w-[620px]">
            <p className="eyebrow">Almost there</p>
            <h1 className="mt-1.5 font-serif text-[28px] font-bold leading-[1.12] tracking-[-0.015em] text-white sm:mt-2 sm:text-[44px] lg:text-[50px]">
              Review and <span className="text-accent">checkout</span>
            </h1>
            <p className="mt-2 max-w-[520px] text-sm font-semibold leading-5 text-white/85 sm:mt-3 sm:text-lg sm:leading-6">
              Confirm your menu, delivery details, and final total before secure
              payment.
            </p>
            <div className="mt-5 hidden max-w-[600px] grid-cols-4 gap-2 sm:grid">
              {[
                { Icon: ShoppingBag, label: 'Menu reviewed' },
                { Icon: Truck, label: 'Delivery details' },
                { Icon: Utensils, label: 'Serving add-ons' },
                { Icon: LockKeyhole, label: 'Secure payment' },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-2.5 py-2 text-white backdrop-blur-sm"
                >
                  <Icon
                    className="h-[18px] w-[18px] shrink-0 text-accent"
                    aria-hidden="true"
                    strokeWidth={2}
                  />
                  <span className="text-[11px] font-extrabold leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1320px] px-3 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-10">
        {error &&
          !paying &&
          validationIssue !== 'payment' &&
          !(!pendingOrder && inlineDeliveryField) && (
            <section
              role="alert"
              aria-live="assertive"
              className={cn(
                'mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm sm:mb-6 sm:px-5 sm:py-4',
                validationIssue === 'checking'
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-red-200 bg-red-50 text-red-950',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full',
                  validationIssue === 'checking'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700',
                )}
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold">
                  {validationIssue
                    ? checkoutIssueTitles[validationIssue]
                    : 'Please review your order'}
                </h2>
                <p className="mt-0.5 text-sm leading-5 opacity-90">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setValidationIssue(undefined);
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </section>
          )}
        <section className="mb-5 overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_16px_44px_-34px_rgba(75,12,23,.7)] sm:mb-7 sm:rounded-3xl">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-primary/[0.055] to-accent/[0.08] px-4 py-3.5 sm:px-6 sm:py-4">
            <h2 className="flex items-center gap-2 font-sans text-lg font-semibold leading-6 text-foreground sm:text-xl">
              <Package className="h-4 w-4 text-primary" aria-hidden="true" />
              Your order{' '}
              <span className="text-muted-foreground">
                ({activeCarts.length})
              </span>
            </h2>
            {!pendingOrder && (
              <Link
                href="/packages"
                className="hidden text-xs font-bold text-primary hover:underline sm:inline"
              >
                + Add package
              </Link>
            )}
          </div>
          <div className="divide-y divide-border/60 px-3 sm:px-6">
            {orderSummaries.map(
              ({ cart: packageCart, itemCount, guestCount, weightKg }) => {
                const packageQuote = multiCartQuote?.carts.find(
                  (entry) => entry.cartId === packageCart.id,
                )?.quote;
                const menuHref =
                  packageCart.package.type === 'ORDER_BY_KG'
                    ? `/order-by-kg?packageVersionId=${packageCart.packageVersionId}&cartId=${packageCart.id}`
                    : packageCart.package.type === 'CUSTOM_PACKAGE'
                      ? `/packages/build?packageVersionId=${packageCart.packageVersionId}&cartId=${packageCart.id}`
                      : `/menu/select?packageVersionId=${packageCart.packageVersionId}&cartId=${packageCart.id}`;
                const menuSummary =
                  itemCount > 0
                    ? `${itemCount} ${itemCount === 1 ? 'dish' : 'dishes'}`
                    : packageCart.package.type === 'FIXED_PACKAGE'
                      ? 'Included menu'
                      : 'No dishes selected';
                return (
                  <article
                    key={packageCart.id}
                    className="min-w-0 py-3.5 sm:py-5"
                  >
                    <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-4">
                      <div className="relative h-[72px] overflow-hidden rounded-xl bg-muted shadow-inner sm:h-[92px] sm:rounded-2xl">
                        {packageCart.package.imageUrl ? (
                          <DataImage
                            src={packageCart.package.imageUrl}
                            alt={packageCart.package.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/10 to-accent/20 text-primary">
                            <Utensils className="h-6 w-6" aria-hidden="true" />
                          </div>
                        )}
                        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-primary shadow-sm">
                          {itemCount || 'Menu'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <h3 className="min-w-0 flex-1 break-words font-sans text-[15px] font-semibold leading-5 text-foreground sm:text-base sm:leading-6">
                            {packageCart.package.name}
                          </h3>
                          <strong className="money-text shrink-0 text-sm font-bold text-primary sm:text-base">
                            {packageQuote
                              ? formatCheckoutCurrency(
                                  packageQuote.subtotalAmount,
                                )
                              : quoteLoading
                                ? 'Updating'
                                : ''}
                          </strong>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
                          {packageCart.package.type === 'ORDER_BY_KG'
                            ? `${weightKg} kg · ${menuSummary}`
                            : `${guestCount} ${packageCart.package.type === 'MEAL_BOX' ? 'boxes' : 'guests'} · ${menuSummary}`}
                        </p>
                        {!pendingOrder && (
                          <div className="mt-1.5 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-5">
                            <Link
                              href={menuHref}
                              className="inline-flex min-h-8 items-center rounded-full bg-primary/[0.06] px-3 text-xs font-bold text-primary transition hover:bg-primary/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
                            >
                              Edit menu
                            </Link>
                            {packageCart.package.type !== 'ORDER_BY_KG' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingQuantityCartId((current) =>
                                    current === packageCart.id
                                      ? ''
                                      : packageCart.id,
                                  )
                                }
                                className="inline-flex min-h-8 items-center text-xs font-semibold text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
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
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {!pendingOrder &&
                      editingQuantityCartId === packageCart.id &&
                      packageCart.package.type !== 'ORDER_BY_KG' && (
                        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            {packageCart.package.type === 'MEAL_BOX'
                              ? 'Box count'
                              : 'Guest count'}
                          </span>
                          <div className="flex h-10 items-center overflow-hidden rounded-md border bg-white">
                            <button
                              type="button"
                              aria-label={`Decrease count for ${packageCart.package.name}`}
                              disabled={
                                Boolean(updatingCartId) ||
                                guestCount <= packageCart.package.minGuestCount
                              }
                              onClick={() =>
                                void updatePackageQuantity(
                                  packageCart,
                                  guestCount - 1,
                                )
                              }
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
                                const next = clampPackageQuantity(
                                  packageCart,
                                  Number(event.target.value),
                                );
                                event.currentTarget.value = String(next);
                                void updatePackageQuantity(packageCart, next);
                              }}
                              className="h-10 w-14 border-x text-center text-sm font-bold outline-none"
                            />
                            <button
                              type="button"
                              aria-label={`Increase count for ${packageCart.package.name}`}
                              disabled={
                                Boolean(updatingCartId) ||
                                Boolean(
                                  packageCart.package.maxGuestCount &&
                                  guestCount >=
                                    packageCart.package.maxGuestCount,
                                )
                              }
                              onClick={() =>
                                void updatePackageQuantity(
                                  packageCart,
                                  guestCount + 1,
                                )
                              }
                              className="grid h-10 w-10 place-items-center text-primary disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                  </article>
                );
              },
            )}
          </div>
          {!pendingOrder && (
            <Link
              href="/packages"
              className="inline-flex min-h-12 items-center px-4 text-sm font-bold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:hidden"
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Add another package
            </Link>
          )}
        </section>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.9fr)] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-5">
            {pendingOrder ? (
              <EventSummary cart={cart} />
            ) : (
              <>
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
                        disabled={
                          updatingDelivery || updatingCutlery || cutleryPending
                        }
                        onChange={updateDeliveryService}
                      />
                      <CutleryOptions
                        cart={cart}
                        quote={quote}
                        disabled={updatingDelivery}
                        onChange={updateCutleryItems}
                        onSyncingChange={setCutleryPending}
                      />
                    </>
                  }
                  onSaved={onEventSaved}
                  onAddAddress={openAddressDialog}
                  onVenueStatusChange={setVenueStatus}
                  onCheckoutStateChange={setCheckoutFields}
                  checkoutFieldError={
                    error && inlineDeliveryField
                      ? { field: inlineDeliveryField, message: error }
                      : undefined
                  }
                  onMissingCart={() =>
                    recoverMissingCart(new Error('Active cart not found'))
                  }
                />
              </>
            )}

            {!pendingOrder && (
              <section
                id="checkout-contact"
                className="rounded-xl border border-border/70 bg-white px-3 py-3 sm:px-4"
              >
                <h2 className="sr-only">Contact and kitchen note</h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                  <UserRound
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  <span className="font-medium text-muted-foreground">
                    Mobile
                  </span>
                  {!editingContact ? (
                    <>
                      <span className="font-semibold text-foreground">
                        {contactNumber ? `+91 ${contactNumber}` : 'Not added'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingContact(true)}
                        className="min-h-7 px-1 font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 min-w-0 items-center overflow-hidden rounded-md border border-input bg-white focus-within:ring-2 focus-within:ring-primary/30">
                        <label
                          htmlFor="cart-contact-number"
                          className="border-r px-2 font-semibold text-muted-foreground"
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
                              event.target.value
                                .replace(/\D/g, '')
                                .slice(0, 10),
                            );
                            setError('');
                          }}
                          maxLength={10}
                          placeholder="9876543210"
                          required
                          className="h-9 min-h-9 w-32 rounded-none border-0 text-xs focus-visible:ring-0"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={savingContact}
                        onClick={() => void saveContactNumber()}
                        className="min-h-8 shrink-0 px-1 font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                      >
                        {savingContact ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2 border-t border-border/60 pt-2">
                  {notesExpanded ? (
                    <div>
                      <label
                        htmlFor="special-kitchen-request"
                        className="flex items-center justify-between gap-4 text-xs font-semibold"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquareText
                            className="h-3.5 w-3.5 text-primary"
                            aria-hidden="true"
                          />
                          Kitchen note
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {specialNotes.length}/1000
                        </span>
                      </label>
                      <textarea
                        id="special-kitchen-request"
                        value={specialNotes}
                        onChange={(event) =>
                          setSpecialNotes(event.target.value)
                        }
                        placeholder="e.g. Keep the food mildly spiced and pack chutney separately."
                        maxLength={1000}
                        rows={3}
                        className="mt-1.5 w-full max-w-2xl resize-y rounded-md border border-border bg-background p-2 text-xs leading-5 outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                      <button
                        type="button"
                        onClick={() => setNotesExpanded(false)}
                        className="min-h-8 text-xs font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        onClick={() => setNotesExpanded(true)}
                        className="inline-flex min-h-7 shrink-0 items-center gap-1.5 text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        {specialNotes
                          ? 'Edit kitchen note'
                          : 'Add kitchen note'}
                      </button>
                      {specialNotes && (
                        <p className="min-w-0 truncate text-xs text-muted-foreground">
                          “{specialNotes}”
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_22px_54px_-38px_rgba(75,12,23,.85)] sm:rounded-3xl">
              <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-accent" />
              <div className="p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-sans text-base font-semibold leading-5 text-foreground">
                      Price breakdown
                    </h2>
                  </div>
                </div>
                {pendingOrder ? (
                  <div>
                    <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-2">
                      <span className="font-semibold">Total</span>
                      <strong className="money-text text-lg font-bold text-primary">
                        {formatCheckoutCurrency(
                          pendingBatch?.totalAmount ?? pendingOrder.totalAmount,
                        )}
                      </strong>
                    </div>
                    <div className="hidden lg:block">
                      <RetryPaymentButton
                        order={pendingOrder}
                        orderIds={pendingBatch?.orderIds}
                        label={
                          paymentError ? 'Retry payment' : 'Secure payment'
                        }
                        className="mt-5 h-12 w-full"
                        onStart={startRetryPayment}
                        onFailure={reportRetryFailure}
                      />
                      {paymentError && (
                        <p role="alert" className="mt-2 text-sm text-red-700">
                          {paymentError}
                        </p>
                      )}
                    </div>
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
                    <div className="hidden lg:block">
                      <Button
                        className="mt-5 h-12 w-full"
                        onClick={requestPayment}
                        disabled={
                          quoteLoading ||
                          updatingCutlery ||
                          cutleryPending ||
                          paying ||
                          paymentNeedsReview
                        }
                      >
                        {!paying && (
                          <LockKeyhole
                            className="mr-2 h-4 w-4"
                            aria-hidden="true"
                          />
                        )}
                        {paying ? 'Opening payment…' : 'Secure payment'}
                      </Button>
                      {paymentError && (
                        <p role="alert" className="mt-2 text-sm text-red-700">
                          {paymentError}
                        </p>
                      )}
                      <p className="mt-1.5 text-center text-xs text-muted-foreground">
                        Redirects to our payment partner.
                      </p>
                    </div>
                  </div>
                )}
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
                      Add delivery address
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
                      Pin the location first, then confirm the address details.
                    </p>
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

              {addressError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-900"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
                    aria-hidden="true"
                  />
                  <span>{addressError}</span>
                </div>
              )}

              <div className="mt-5">
                <AddressMapPicker
                  onAddress={useMappedAddress}
                  initialPosition={
                    addressForm.latitude && addressForm.longitude
                      ? {
                          latitude: addressForm.latitude,
                          longitude: addressForm.longitude,
                        }
                      : undefined
                  }
                  inlineMobileSearch
                />
                {addressForm.latitude &&
                  addressForm.longitude &&
                  addressForm.addressLine1.trim() && (
                    <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">
                      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Location pinned. Review the complete address below.
                    </p>
                  )}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Complete address
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <AddressDetailsFields
                className="mt-4"
                value={addressForm}
                onChange={(value) =>
                  setAddressForm((current) => ({
                    ...value,
                    latitude: current.latitude,
                    longitude: current.longitude,
                  }))
                }
              />
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

      {!keyboardOpen && (
        <MobileOrderBar checkout label="Checkout total and pay securely">
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
            {pendingOrder ? (
              <RetryPaymentButton
                order={pendingOrder}
                orderIds={pendingBatch?.orderIds}
                className="mobile-order-bar-action"
                label={paymentError ? 'Retry payment' : 'Secure payment'}
                onStart={startRetryPayment}
                onFailure={reportRetryFailure}
              />
            ) : (
              <Button
                className="mobile-order-bar-action"
                onClick={requestPayment}
                disabled={
                  quoteLoading ||
                  updatingCutlery ||
                  cutleryPending ||
                  paying ||
                  paymentNeedsReview
                }
              >
                {!paying && (
                  <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {paying ? 'Opening…' : 'Secure payment'}
              </Button>
            )}
          </div>
          {paymentError && (
            <p
              role="alert"
              className="mx-auto mt-1.5 max-w-2xl px-1 text-xs leading-4 text-red-700"
            >
              {paymentError}
            </p>
          )}
        </MobileOrderBar>
      )}
    </main>
  );
}

function eventReady(cart: CartSummary) {
  return Boolean(
    cart.event?.address && cart.event.eventDate && cart.event.eventTimeStart,
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
  onSyncingChange,
  defaultOpen = false,
}: {
  cart: CartSummary;
  quote?: PackageSelectionPrice;
  disabled: boolean;
  onChange: (
    items: Array<{ itemId: string; quantity: number }>,
  ) => Promise<void>;
  onSyncingChange?: (syncing: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  const sourceItems = useMemo(
    () =>
      [...(quote?.cutleryItems ?? cart.cutleryItems ?? [])].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      ),
    [cart.cutleryItems, quote?.cutleryItems],
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const quantitiesRef = useRef<Record<string, number>>({});
  const pendingQuantitiesRef = useRef<Record<string, number> | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const persistInFlightRef = useRef(false);

  useEffect(() => {
    if (pendingQuantitiesRef.current || persistInFlightRef.current) return;
    const next = Object.fromEntries(
      sourceItems.map((item) => [item.id, item.quantity ?? 0]),
    );
    quantitiesRef.current = next;
    setQuantities(next);
  }, [sourceItems]);

  useEffect(
    () => () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
      onSyncingChange?.(false);
    },
    [onSyncingChange],
  );

  const includedItems = sourceItems.filter((item) => item.includedQuantity > 0);
  const total = sourceItems.reduce(
    (sum, item) => sum + Number(item.unitPrice) * (quantities[item.id] ?? 0),
    0,
  );
  const selectedCount = Object.values(quantities).reduce(
    (sum, value) => sum + value,
    0,
  );
  const selectedItems = sourceItems.filter(
    (item) => (quantities[item.id] ?? 0) > 0,
  );

  function changedQuantities(itemId: string, delta: number) {
    return {
      ...quantitiesRef.current,
      [itemId]: Math.max(
        0,
        Math.min(10000, (quantitiesRef.current[itemId] ?? 0) + delta),
      ),
    };
  }

  function payload(next: Record<string, number>) {
    return sourceItems.map((item) => ({
      itemId: item.id,
      quantity: next[item.id] ?? 0,
    }));
  }

  function queueQuantityChange(next: Record<string, number>) {
    quantitiesRef.current = next;
    setQuantities(next);
    pendingQuantitiesRef.current = next;
    onSyncingChange?.(true);
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(
      () => void persistPending(),
      600,
    );
  }

  async function persistPending() {
    if (persistInFlightRef.current) return;
    const next = pendingQuantitiesRef.current;
    if (!next) return;
    pendingQuantitiesRef.current = null;
    persistInFlightRef.current = true;
    setSaving(true);
    try {
      await onChange(payload(next));
    } finally {
      persistInFlightRef.current = false;
      if (pendingQuantitiesRef.current) {
        persistTimerRef.current = window.setTimeout(
          () => void persistPending(),
          300,
        );
      } else {
        setSaving(false);
        onSyncingChange?.(false);
      }
    }
  }

  function changeQuantity(itemId: string, delta: number) {
    if (disabled) return;
    queueQuantityChange(changedQuantities(itemId, delta));
  }

  function clearQuantity(itemId: string) {
    if (disabled || (quantitiesRef.current[itemId] ?? 0) === 0) return;
    queueQuantityChange({
      ...quantitiesRef.current,
      [itemId]: 0,
    });
  }

  function renderQuantityControl(item: CutleryItem) {
    const quantity = quantities[item.id] ?? 0;
    return (
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          disabled={disabled || quantity === 0}
          onClick={() => clearQuantity(item.id)}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg text-red-600 transition duration-150 hover:bg-red-50 active:scale-95 disabled:pointer-events-none',
            quantity === 0 ? 'opacity-0' : 'opacity-100',
          )}
          aria-label={`Clear ${item.extraLabel || item.name}`}
          title="Clear quantity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled || quantity === 0}
          onClick={() => changeQuantity(item.id, -1)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[#dcccb7] text-primary transition duration-150 hover:bg-[#faf5ed] active:scale-95 disabled:text-stone-300"
          aria-label={`Decrease ${item.extraLabel || item.name}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="money-text w-5 text-center text-sm font-semibold tabular-nums">
          {quantity}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => changeQuantity(item.id, 1)}
          className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white shadow-sm transition duration-150 hover:bg-primary/90 active:scale-95 disabled:opacity-50"
          aria-label={`Increase ${item.extraLabel || item.name}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  function renderExtraRow(item: CutleryItem) {
    return (
      <article
        key={item.id}
        className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-[#e7e0d4] bg-white p-1.5 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:p-2"
      >
        <DataImage
          src={item.imageUrl}
          alt={item.name}
          className="h-11 w-11 rounded-lg object-cover sm:h-12 sm:w-12"
        />
        <div className="min-w-0">
          <h4 className="truncate text-xs font-semibold text-foreground sm:text-sm">
            {item.extraLabel || item.name}
          </h4>
          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
            <strong className="money-text text-primary">
              {formatCurrency(item.unitPrice).replace(/\.00$/, '')}
            </strong>{' '}
            / {item.unitLabel}
          </p>
        </div>
        {renderQuantityControl(item)}
      </article>
    );
  }

  return (
    <section
      aria-busy={saving}
      className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm sm:mt-5"
    >
      <div className="flex items-center gap-2.5 border-b border-border/60 px-3 py-3 sm:px-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/[0.08]">
          <Utensils className="h-4 w-4 text-primary" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground">Cutlery</h3>
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-100 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-emerald-800 sm:text-[10px]">
            <Check className="h-3 w-3" /> 10 sets included
          </span>
          {selectedCount > 0 && (
            <span className="money-text text-[10px] font-semibold text-primary sm:text-xs">
              Extras {formatCurrency(total).replace(/\.00$/, '')}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={sourceItems.length === 0}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full bg-primary/[0.07] px-2.5 text-[11px] font-bold text-primary transition hover:bg-primary/[0.12] disabled:opacity-50"
        >
          {expanded ? 'Hide' : 'Add more'}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="px-3 py-3 sm:px-4">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {includedItems.map((item) => (
            <article
              key={item.id}
              className="flex min-w-0 items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/40 p-1.5"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#fbfaf7] sm:h-12 sm:w-12">
                <DataImage
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-0.5 right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Check className="h-2.5 w-2.5" />
                </span>
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-[9px] font-bold text-foreground sm:text-xs">
                  {item.name}
                </h4>
                <p className="truncate text-[8px] text-emerald-700 sm:text-[10px]">
                  {item.includedQuantity} included
                </p>
              </div>
            </article>
          ))}
        </div>

        {!expanded && selectedItems.length > 0 && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <div className="space-y-1.5">
              {selectedItems.map(renderExtraRow)}
            </div>
          </div>
        )}

        {expanded && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <div className="space-y-1.5">{sourceItems.map(renderExtraRow)}</div>
          </div>
        )}
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
                <Icon
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
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
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm leading-6">{value}</p>
      </div>
    </div>
  );
}
