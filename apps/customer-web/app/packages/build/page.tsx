'use client';
import { DataImage } from '../../../components/data-image';
import { MobileOrderBar } from '../../../components/mobile-order-bar';

import type {
  CartSummary,
  PackageConfiguration,
  PackageSummary,
} from '@aranyam/shared-types';
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import {
  isClearedCartError,
  subscribeToCartCleared,
} from '../../../lib/cart-state';
import { formatCategoryLabel } from '../../../lib/format';
import { sortMenuCategories } from '../../../lib/menu-category-order';
import { cn } from '../../../lib/utils';
import { useDeliveryLocationStore } from '../../../store/delivery-location.store';
import { useOrderBuilderStore } from '../../../store/order-builder.store';
import { useSessionStore } from '../../../store/session.store';

const MIN_GUESTS = 20;
const MAX_GUESTS = 1000;

type Dish = {
  id: string;
  name: string;
  price: number;
  veg: boolean;
  cat: string;
  categoryId: string;
  categoryName: string;
  itemPrice: string;
  includedValue?: string;
  adjustmentAmount: string;
  imageUrl?: string | null;
};
type DishId = string;
type CategoryFilter = 'all' | string;
type DietFilter = 'all' | 'veg' | 'nonveg';

function dishesFromConfig(config: PackageConfiguration): Dish[] {
  return config.categoryRules.flatMap((rule) =>
    rule.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.itemPrice ?? item.adjustmentAmount ?? 0),
      veg: item.isVeg,
      cat: rule.category.id,
      categoryId: rule.category.id,
      categoryName: rule.category.name,
      itemPrice: item.itemPrice,
      includedValue: item.includedValue,
      adjustmentAmount: item.adjustmentAmount,
      imageUrl: item.imageUrl,
    })),
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function getDishImage(dish: Dish) {
  if (dish.cat === 'rice-bread') return '/tray-3.png';
  if (dish.cat === 'dessert') return '/tray-5.png';
  if (dish.cat === 'beverage') return '/tray-8.png';
  if (dish.cat === 'main-course') return '/pkg-farmhouse.png';
  return '/order-build.png';
}

function VegDot({ veg }: { veg: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border',
        veg ? 'border-emerald-600' : 'border-red-600',
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          veg ? 'bg-emerald-600' : 'bg-red-600',
        )}
      />
    </span>
  );
}

function GuestStepper({
  guestCount,
  guestInput,
  minGuestCount,
  maxGuestCount,
  onStep,
  onInputChange,
  onInputBlur,
}: {
  guestCount: number;
  guestInput: string;
  minGuestCount: number;
  maxGuestCount?: number | null;
  onStep: (delta: number) => void;
  onInputChange: (value: string) => void;
  onInputBlur: () => void;
}) {
  return (
    <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3 border-t border-border/30 pt-1.5">
      <div className="min-w-0">
        <label
          htmlFor="guest-count"
          className="block text-xs font-bold text-muted-foreground"
        >
          Guests
        </label>
      </div>
      <div className="numeric-text inline-flex h-9 shrink-0 items-center overflow-hidden rounded-lg border border-border bg-white">
        <button
          type="button"
          aria-label="Decrease guest count"
          disabled={guestCount <= minGuestCount}
          onClick={() => onStep(-1)}
          className="grid h-9 w-9 shrink-0 place-items-center text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          id="guest-count"
          inputMode="numeric"
          value={guestInput}
          onBlur={onInputBlur}
          onChange={(event) => onInputChange(event.target.value)}
          className="h-9 w-9 border-x border-border text-center text-[13px] font-bold outline-none focus:bg-primary/[0.03]"
        />
        <button
          type="button"
          aria-label="Increase guest count"
          disabled={Boolean(maxGuestCount && guestCount >= maxGuestCount)}
          onClick={() => onStep(1)}
          className="grid h-9 w-9 shrink-0 place-items-center text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DishCatalogue({
  categories,
  category,
  diet,
  onCategoryChange,
  onClearSearch,
  onDietChange,
  onToggleDish,
  search,
  selectedIds,
  setSearch,
  visible,
}: {
  categories: Array<{ id: CategoryFilter; label: string }>;
  category: CategoryFilter;
  diet: DietFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onClearSearch: () => void;
  onDietChange: (diet: DietFilter) => void;
  onToggleDish: (id: DishId) => void;
  search: string;
  selectedIds: Set<DishId>;
  setSearch: (value: string) => void;
  visible: Dish[];
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <aside className="flex w-full min-w-0 max-w-full flex-col rounded-2xl border border-border bg-white shadow-[0_8px_22px_rgba(45,31,20,0.045)] lg:sticky lg:top-20 lg:h-auto lg:max-h-[calc(100vh-96px)] lg:overflow-hidden">
      <div className="shrink-0 border-b border-border p-2">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <div
              className="grid flex-1 grid-cols-3 gap-1 rounded-xl border border-border bg-[#fbf8f2] p-1"
              role="radiogroup"
              aria-label="Diet filter"
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'veg', label: 'Veg', dot: 'bg-emerald-600' },
                { id: 'nonveg', label: 'Non-veg', dot: 'bg-red-600' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={diet === option.id}
                  onClick={() => onDietChange(option.id as DietFilter)}
                  className={cn(
                    'flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    diet === option.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-foreground hover:border-primary/30 hover:text-primary',
                  )}
                >
                  {option.dot && (
                    <span className={cn('h-2 w-2 rounded-full', option.dot)} />
                  )}
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-expanded={searchOpen}
              aria-label={searchOpen ? 'Close dish search' : 'Search dishes'}
              onClick={() => {
                if (searchOpen) onClearSearch();
                setSearchOpen((open) => !open);
              }}
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                searchOpen
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-[#fbf8f2] text-muted-foreground hover:border-primary/30 hover:text-primary',
              )}
            >
              {searchOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>

          <div
            aria-hidden={!searchOpen}
            className={cn(
              'grid transition-all duration-200 ease-out',
              searchOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-[#fbf8f2] px-3 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">Search dishes</span>
                <input
                  tabIndex={searchOpen ? 0 : -1}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search dishes..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear dish search"
                    onClick={onClearSearch}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-primary hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCategoryChange(cat.id)}
                  className={cn(
                    'min-h-8 shrink-0 rounded-full border px-2.5 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    active
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-foreground hover:border-primary/35 hover:text-primary',
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        <div className="space-y-1.5">
          {visible.map((dish) => {
            const selected = selectedIds.has(dish.id);
            return (
              <article
                key={dish.id}
                className="grid min-h-[64px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-white px-2 py-1.5 transition hover:border-primary/25 hover:bg-[#fffdf8] sm:min-h-[76px] sm:grid-cols-[50px_minmax(0,1fr)_auto] sm:gap-2.5 sm:px-2.5 sm:py-2 lg:min-h-[88px] lg:grid-cols-[64px_minmax(0,1fr)_auto]"
              >
                <DataImage
                  src={dish.imageUrl ?? getDishImage(dish)}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover sm:h-[50px] sm:w-[50px] lg:h-16 lg:w-16"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <VegDot veg={dish.veg} />
                    <h3 className="min-w-0 text-[13px] font-bold leading-tight text-foreground sm:text-[15px]">
                      {dish.name}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="money-text text-[11px] font-extrabold text-foreground sm:text-[13px]">
                      {formatCurrency(dish.price)} / plate
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleDish(dish.id)}
                  className={cn(
                    'inline-flex min-h-8 w-fit min-w-[58px] items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-9 sm:min-w-[70px] sm:px-2.5 sm:text-sm',
                    selected
                      ? 'border-primary bg-primary text-white hover:bg-primary/90'
                      : 'border-primary/45 bg-white text-primary hover:bg-primary/5',
                  )}
                >
                  {selected ? (
                    <>
                      Added <Check className="h-4 w-4" />
                    </>
                  ) : (
                    'Add'
                  )}
                </button>
              </article>
            );
          })}
        </div>

        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-[#fbf8f2] px-4 py-8 text-center">
            <p className="text-sm font-bold text-foreground">
              No dishes match your search.
            </p>
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-3 min-h-11 rounded-full border border-primary/35 bg-white px-5 text-sm font-extrabold text-primary transition hover:bg-primary/5"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SummaryPanel({
  estimatedSubtotal,
  guestCount,
  message,
  nonVegCount,
  onAddToCart,
  order,
  saving,
  subtotalPerPlate,
  vegCount,
}: {
  estimatedSubtotal: number;
  guestCount: number;
  message: string;
  nonVegCount: number;
  onAddToCart: () => void;
  order: DishId[];
  saving: boolean;
  subtotalPerPlate: number;
  vegCount: number;
}) {
  return (
    <aside className="rounded-2xl border border-border bg-white p-4 shadow-[0_8px_22px_rgba(45,31,20,0.045)] lg:sticky lg:top-20">
      <p className="eyebrow text-primary">Live Summary</p>
      <h2 className="mt-1 font-sans text-xl font-semibold">Your package</h2>
      {order.length === 0 && (
        <div className="mt-3 rounded-xl border border-border bg-[#fbf8f2] p-3 text-sm">
          <ShoppingBag className="mb-2 h-4 w-4 text-primary" />
          <p className="font-bold text-foreground">No dishes added yet</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Add dishes from the menu to build your package.
          </p>
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-[#fbf8f2]">
        {[
          ['Items', order.length],
          ['Veg', vegCount],
          ['Non-veg', nonVegCount],
        ].map(([label, value]) => (
          <div key={label} className="p-2.5">
            <p className="text-[11px] font-extrabold text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 font-sans text-xl font-semibold text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Guests</span>
          <strong>{guestCount}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Per guest estimate</span>
          <strong className="money-text">
            {subtotalPerPlate ? formatCurrency(subtotalPerPlate) : '-'}
          </strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-primary">Estimated subtotal</span>
          <strong className="money-text text-primary">
            {estimatedSubtotal ? formatCurrency(estimatedSubtotal) : '-'}
          </strong>
        </div>
        <div className="flex justify-between gap-4 rounded-xl bg-primary/[0.055] p-2.5">
          <span className="font-extrabold text-primary">Estimated total</span>
          <strong className="money-text text-primary">
            {estimatedSubtotal ? formatCurrency(estimatedSubtotal) : '-'}
          </strong>
        </div>
        <p className="text-xs text-muted-foreground">Excluding taxes</p>
      </div>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          disabled={order.length === 0 || saving}
          onClick={onAddToCart}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-extrabold text-white transition hover:bg-primary/90 disabled:bg-primary/35"
        >
          <ShoppingBag className="h-4 w-4" />{' '}
          {saving ? 'Adding...' : 'Add to Cart'}
        </button>
        {order.length === 0 && (
          <p className="text-center text-xs font-semibold text-muted-foreground">
            Add at least one dish to continue.
          </p>
        )}
        {message && (
          <p className="rounded-lg border border-red-100 bg-red-50 p-2 text-xs font-semibold text-red-800">
            {message}
          </p>
        )}
      </div>
    </aside>
  );
}

export default function BuildPackagePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background p-4">
          <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
        </main>
      }
    >
      <BuildPackageContent />
    </Suspense>
  );
}

function BuildPackageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSessionStore((state) => state.session);
  const deliveryLocation = useDeliveryLocationStore((state) => state.location);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const setStoredGuestCount = useOrderBuilderStore(
    (state) => state.setGuestCount,
  );
  const requestedVersionId = searchParams.get('packageVersionId');
  const cartId = searchParams.get('cartId');
  const packageId = searchParams.get('packageId');
  const [packageVersionId, setPackageVersionId] = useState(requestedVersionId);
  const [cat, setCat] = useState<CategoryFilter>('all');
  const [diet, setDiet] = useState<DietFilter>('all');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<DishId[]>([]);
  const [guestCount, setGuestCount] = useState(150);
  const [guestInput, setGuestInput] = useState('150');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const hydratedCartVersion = useRef<string | undefined>(undefined);
  const workingCartId = useRef<string | null>(cartId);
  const lastUrlCartId = useRef(cartId);

  useEffect(() => {
    if (lastUrlCartId.current === cartId) return;
    lastUrlCartId.current = cartId;
    workingCartId.current = cartId;
  }, [cartId]);

  const discardStaleCart = useCallback(() => {
    workingCartId.current = null;
    setDbCartId(undefined);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('cartId');
    const query = next.toString();
    router.replace(query ? `/packages/build?${query}` : '/packages/build');
  }, [router, searchParams, setDbCartId]);

  useEffect(() => {
    if (requestedVersionId) return;
    let active = true;
    apiRequest<PackageSummary[]>('/packages')
      .then((packages) => {
        const selectedPackage = packageId
          ? packages.find((pkg) => pkg.id === packageId)
          : packages.find((pkg) => pkg.type === 'CUSTOM_PACKAGE');
        const latestVersion = selectedPackage?.activeVersion?.id;
        if (active && latestVersion) setPackageVersionId(latestVersion);
        if (active && !latestVersion)
          setMessage('Custom menu is currently unavailable.');
      })
      .catch(() => {
        if (active) setMessage('Custom menu is currently unavailable.');
      });
    return () => {
      active = false;
    };
  }, [packageId, requestedVersionId]);

  useEffect(() => {
    if (!packageVersionId) return;
    let active = true;
    apiRequest<PackageConfiguration>(
      `/package-versions/${packageVersionId}/configuration`,
    )
      .then((nextConfig) => {
        if (!active) return;
        const nextDishes = dishesFromConfig(nextConfig);
        setConfig(nextConfig);
        setDishes(nextDishes);
        setClampedGuestCount(nextConfig.minGuestCount || MIN_GUESTS);
        setOrder((current) =>
          current.filter((id) => nextDishes.some((dish) => dish.id === id)),
        );
      })
      .catch((reason) => {
        if (active) {
          setDishes([]);
          setMessage(
            (reason as Error).message || 'Menu is currently unavailable.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [packageVersionId]);

  useEffect(() => {
    if (
      !session ||
      !packageVersionId ||
      !dishes.length ||
      hydratedCartVersion.current === packageVersionId
    ) {
      return;
    }

    let active = true;
    apiRequest<CartSummary | null>(
      cartId ? `/cart/${cartId}` : '/cart',
      {},
      session.accessToken,
    )
      .then((cart) => {
        if (!active) return;
        hydratedCartVersion.current = packageVersionId;
        if (
          !cart ||
          cart.status !== 'ACTIVE' ||
          cart.packageVersionId !== packageVersionId
        )
          return;

        const availableIds = new Set(dishes.map((dish) => dish.id));
        setOrder(
          cart.items
            .filter(
              (item) =>
                item.role === 'CUSTOM' && availableIds.has(item.menuItemId),
            )
            .map((item) => item.menuItemId),
        );

        const savedGuestCount = cart.event?.guestCount ?? cart.guestCount;
        if (savedGuestCount) setClampedGuestCount(savedGuestCount);
        setDbCartId(cart.id);
      })
      .catch((reason) => {
        if (!active) return;
        if (isClearedCartError(reason)) {
          discardStaleCart();
          return;
        }
        setMessage((reason as Error).message);
      });

    return () => {
      active = false;
    };
  }, [cartId, discardStaleCart, dishes, packageVersionId, session, setDbCartId]);

  useEffect(
    () => subscribeToCartCleared(discardStaleCart),
    [discardStaleCart],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dishes.filter((dish) => {
      const matchesCategory = cat === 'all' || dish.cat === cat;
      const matchesDiet =
        diet === 'all' || (diet === 'veg' ? dish.veg : !dish.veg);
      const matchesSearch = !query || dish.name.toLowerCase().includes(query);
      return matchesCategory && matchesDiet && matchesSearch;
    });
  }, [cat, diet, dishes, search]);

  const categories = useMemo<
    Array<{ id: CategoryFilter; label: string }>
  >(() => {
    const seen = new Map<string, string>();
    for (const dish of dishes) {
      seen.set(dish.categoryId, formatCategoryLabel(dish.categoryName));
    }
    return [
      { id: 'all', label: 'All' },
      ...sortMenuCategories(
        Array.from(seen.entries()).map(([id, label]) => ({ id, label })),
        (category) => category.label,
      ),
    ];
  }, [dishes]);

  const addedIds = useMemo(() => new Set(order), [order]);
  const dishMap = useMemo(
    () =>
      Object.fromEntries(dishes.map((dish) => [dish.id, dish])) as Record<
        string,
        Dish
      >,
    [dishes],
  );
  const vegCount = order.filter((id) => dishMap[id]?.veg).length;
  const nonVegCount = order.length - vegCount;
  const subtotalPerPlate = order.reduce(
    (sum, id) => sum + (dishMap[id]?.price ?? 0),
    0,
  );
  const estimatedSubtotal = subtotalPerPlate * guestCount;

  function setClampedGuestCount(value: number) {
    const minimum = config?.minGuestCount ?? MIN_GUESTS;
    const maximum = config?.maxGuestCount ?? MAX_GUESTS;
    const next = Math.min(maximum, Math.max(minimum, value));
    setGuestCount(next);
    setStoredGuestCount(next);
    setGuestInput(String(next));
  }

  function handleGuestInput(value: string) {
    const digits = value.replace(/\D/g, '');
    setGuestInput(digits);
  }

  function handleGuestBlur() {
    if (!guestInput) {
      setGuestInput(String(guestCount));
      return;
    }
    setClampedGuestCount(Number(guestInput));
  }

  function toggleDish(id: DishId) {
    setOrder((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current, id];
    });
  }

  async function addToCart() {
    if (saving || order.length === 0) return;
    if (!packageVersionId) {
      setMessage('Choose a package before adding dishes to cart.');
      return;
    }
    if (!session) {
      const query = searchParams.toString();
      router.push(
        `/login?returnTo=${encodeURIComponent(
          query ? `/packages/build?${query}` : '/packages/build',
        )}`,
      );
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const createCart = () =>
        apiRequest<CartSummary>(
          '/cart',
          {
            method: 'POST',
            body: JSON.stringify({
              packageVersionId,
              ...(deliveryLocation?.resolution.serviceable &&
              deliveryLocation.resolution.region
                ? { regionId: deliveryLocation.resolution.region.id }
                : {}),
              guestCount,
            }),
          },
          session.accessToken,
        );
      let cart: CartSummary;
      if (!workingCartId.current) cart = await createCart();
      else {
        try {
          cart = await apiRequest<CartSummary>(
            `/cart/${workingCartId.current}/quantity`,
            { method: 'PUT', body: JSON.stringify({ guestCount }) },
            session.accessToken,
          );
        } catch (reason) {
          if (!isClearedCartError(reason)) throw reason;
          setDbCartId(undefined);
          cart = await createCart();
        }
      }
      workingCartId.current = cart.id;
      setDbCartId(cart.id);
      await apiRequest(
        `/cart/${cart.id}/items`,
        {
          method: 'PUT',
          body: JSON.stringify({
            items: order
              .map((id) => dishMap[id])
              .filter(Boolean)
              .map((dish) => ({
                categoryId: dish.categoryId,
                menuItemId: dish.id,
                role:
                  config?.packageType === 'FIXED_PACKAGE' ? 'EXTRA' : 'CUSTOM',
                quantity: 1,
              })),
          }),
        },
        session.accessToken,
      );
      router.push('/cart');
    } catch (reason) {
      setMessage((reason as Error).message);
      setSaving(false);
    }
  }

  const catalogue = (
    <DishCatalogue
      category={cat}
      categories={categories}
      diet={diet}
      onCategoryChange={setCat}
      onClearSearch={() => setSearch('')}
      onDietChange={setDiet}
      onToggleDish={toggleDish}
      search={search}
      selectedIds={addedIds}
      setSearch={setSearch}
      visible={visible}
    />
  );

  const builderHeader = (
    <section className="overflow-hidden border-b border-border/30 bg-white px-3 py-2 sm:border sm:px-4 sm:py-3">
      <div>
        {/* <p className="eyebrow text-primary">Build your menu</p> */}
        <h1 className="font-serif text-[22px] font-semibold leading-[1.12] tracking-[-0.015em] text-charcoal sm:text-[30px]">
          Build Your Own Package
        </h1>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-muted-foreground">
          Pick the dishes your guests will enjoy.
        </p>
      </div>
      <GuestStepper
        guestCount={guestCount}
        guestInput={guestInput}
        minGuestCount={config?.minGuestCount ?? MIN_GUESTS}
        maxGuestCount={config?.maxGuestCount}
        onInputBlur={handleGuestBlur}
        onInputChange={handleGuestInput}
        onStep={(delta) => setClampedGuestCount(guestCount + delta)}
      />
    </section>
  );

  const summary = (
    <SummaryPanel
      estimatedSubtotal={estimatedSubtotal}
      guestCount={guestCount}
      message={message}
      nonVegCount={nonVegCount}
      onAddToCart={addToCart}
      order={order}
      saving={saving}
      subtotalPerPlate={subtotalPerPlate}
      vegCount={vegCount}
    />
  );

  if (!dishes.length && (message || !packageVersionId)) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-background p-6">
        <section className="max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <h1 className="font-sans text-2xl font-semibold text-foreground">
            Menu currently unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            We could not load the menu right now. Please try again in a moment.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-background pb-36 lg:pb-16">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-2 sm:px-5 sm:py-3 lg:px-6">
        {builderHeader}
        <div className="mt-2 grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start">
          <div className="min-w-0">{catalogue}</div>
          <div className="hidden lg:block">{summary}</div>
        </div>
      </div>

      <MobileOrderBar label="Custom menu total and cart">
        <div className="mobile-order-bar-row">
          <div className="mobile-order-bar-summary">
            <p className="mobile-order-bar-label">
              {order.length} selected for {guestCount} guests
            </p>
            <p className="mobile-order-bar-total">
              {estimatedSubtotal
                ? formatCurrency(estimatedSubtotal)
                : 'Select dishes'}
            </p>
          </div>
          <button
            type="button"
            disabled={order.length === 0 || saving}
            onClick={addToCart}
            className="mobile-order-bar-action gap-2"
          >
            {saving ? 'Adding...' : 'Add to Cart'}{' '}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </MobileOrderBar>
    </main>
  );
}
