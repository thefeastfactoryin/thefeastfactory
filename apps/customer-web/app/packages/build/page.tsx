'use client';

import type { CartSummary, PackageConfiguration } from '@aranyam/shared-types';
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { cn } from '../../../lib/utils';
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
};
type DishId = string;
type CategoryFilter = 'all' | string;
type DietFilter = 'all' | 'veg' | 'nonveg';
type MobileTab = 'dishes' | 'summary';

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
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2 shadow-sm">
      <div className="min-w-0">
        <label
          htmlFor="guest-count"
          className="block text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Guests
        </label>
        <p className="mt-0.5 text-[11px] font-semibold leading-4 text-muted-foreground">
          Min {minGuestCount}
        </p>
      </div>
      <div className="flex h-10 shrink-0 items-center overflow-hidden rounded-lg border border-border bg-[#fbf8f2] focus-within:ring-2 focus-within:ring-primary/20">
        <button
          type="button"
          aria-label="Decrease guest count"
          disabled={guestCount <= minGuestCount}
          onClick={() => onStep(-1)}
          className="grid h-10 w-10 shrink-0 place-items-center text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          id="guest-count"
          inputMode="numeric"
          value={guestInput}
          onBlur={onInputBlur}
          onChange={(event) => onInputChange(event.target.value)}
          className="h-10 w-14 border-x border-border bg-white text-center text-sm font-extrabold text-foreground outline-none"
        />
        <button
          type="button"
          aria-label="Increase guest count"
          disabled={Boolean(maxGuestCount && guestCount >= maxGuestCount)}
          onClick={() => onStep(1)}
          className="grid h-10 w-10 shrink-0 place-items-center text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DishCatalogue({
  categories,
  category,
  counts,
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
  counts: Record<CategoryFilter, number>;
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
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_8px_22px_rgba(45,31,20,0.045)] lg:sticky lg:top-20 lg:max-h-[calc(100vh-96px)]">
      <div className="shrink-0 border-b border-border p-3">
        <div className="space-y-2.5">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-[#fbf8f2] px-3 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Search dishes</span>
            <input
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

          <div
            className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-[#fbf8f2] p-1"
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
                  'flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
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
                    'min-h-9 shrink-0 rounded-full border px-2.5 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    active
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-foreground hover:border-primary/35 hover:text-primary',
                  )}
                >
                  {cat.label}
                  <span
                    className={cn(
                      'ml-1.5',
                      active ? 'text-white/75' : 'text-muted-foreground',
                    )}
                  >
                    {counts[cat.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-visible p-2 lg:overflow-y-auto">
        <div className="space-y-2">
          {visible.map((dish) => {
            const selected = selectedIds.has(dish.id);
            return (
              <article
                key={dish.id}
                className="grid min-h-[88px] grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 transition hover:border-primary/25 hover:bg-[#fffdf8]"
              >
                <Image
                  src={getDishImage(dish)}
                  alt=""
                  width={56}
                  height={56}
                  sizes="56px"
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <VegDot veg={dish.veg} />
                    <h3 className="min-w-0 text-[15px] font-bold leading-tight text-foreground">
                      {dish.name}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13px] font-extrabold text-foreground">
                      {formatCurrency(dish.price)} / plate
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleDish(dish.id)}
                  className={cn(
                    'inline-flex min-h-10 w-fit min-w-[84px] items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
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
  onViewSummary,
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
  onViewSummary: () => void;
  order: DishId[];
  saving: boolean;
  subtotalPerPlate: number;
  vegCount: number;
}) {
  return (
    <aside className="rounded-2xl border border-border bg-white p-4 shadow-[0_8px_22px_rgba(45,31,20,0.045)] lg:sticky lg:top-20">
      <p className="eyebrow text-primary">Live Summary</p>
      <h2 className="mt-1 font-serif text-xl font-bold">Your package</h2>
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
            <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 font-serif text-xl font-bold text-foreground">
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
          <strong>
            {subtotalPerPlate ? formatCurrency(subtotalPerPlate) : '-'}
          </strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-primary">Estimated subtotal</span>
          <strong className="text-primary">
            {estimatedSubtotal ? formatCurrency(estimatedSubtotal) : '-'}
          </strong>
        </div>
        <div className="flex justify-between gap-4 rounded-xl bg-primary/[0.055] p-2.5">
          <span className="font-extrabold text-primary">Estimated total</span>
          <strong className="text-primary">
            {estimatedSubtotal ? formatCurrency(estimatedSubtotal) : '-'}
          </strong>
        </div>
        <p className="text-xs text-muted-foreground">Excluding taxes</p>
      </div>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onViewSummary}
          disabled={order.length === 0}
          className="min-h-11 rounded-full border border-primary/35 bg-white px-4 text-sm font-extrabold text-primary transition hover:bg-primary/5"
        >
          View Summary
        </button>
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
  const [mobileTab, setMobileTab] = useState<MobileTab>('dishes');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const hydratedCartVersion = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (requestedVersionId || !packageId) return;
    let active = true;
    apiRequest<Array<{ id: string; activeVersion?: { id: string } | null }>>(
      '/packages',
    )
      .then((packages) => {
        const latestVersion = packages.find((pkg) => pkg.id === packageId)
          ?.activeVersion?.id;
        if (active && latestVersion) setPackageVersionId(latestVersion);
        if (active && !latestVersion)
          setMessage('Package is currently unavailable.');
      })
      .catch(() => {
        if (active) setMessage('Package is currently unavailable.');
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
        if (!cart || cart.packageVersionId !== packageVersionId) return;

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
        if (active) setMessage((reason as Error).message);
      });

    return () => {
      active = false;
    };
  }, [cartId, dishes, packageVersionId, session, setDbCartId]);

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
    for (const dish of dishes) seen.set(dish.categoryId, dish.categoryName);
    return [
      { id: 'all', label: 'All' },
      ...Array.from(seen.entries()).map(([id, label]) => ({ id, label })),
    ];
  }, [dishes]);

  const counts = useMemo(() => {
    const initial = Object.fromEntries(
      categories.map((cat) => [cat.id, 0]),
    ) as Record<CategoryFilter, number>;
    for (const dish of dishes) {
      initial.all += 1;
      initial[dish.cat] += 1;
    }
    return initial;
  }, [categories, dishes]);

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
      if (current.length >= 12) return current;
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
      const cart = await apiRequest<CartSummary>(
        cartId ? `/cart/${cartId}/quantity` : '/cart',
        {
          method: cartId ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...(cartId ? {} : { packageVersionId }),
            guestCount,
          }),
        },
        session.accessToken,
      );
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
      counts={counts}
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
    <div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--hero-end))] px-5 py-5 text-white shadow-[0_8px_24px_rgba(45,20,20,0.12)] sm:px-7">
      <div
        className="absolute -right-10 -top-24 h-56 w-56 rounded-full border-[28px] border-accent/15"
        aria-hidden="true"
      />
      <div
        className="absolute right-16 top-7 hidden h-20 w-20 place-items-center rounded-full border border-dashed border-accent/55 bg-white/5 sm:grid"
        aria-hidden="true"
      >
        <img
          src="/logo.png"
          alt=""
          className="h-14 w-14 rounded-xl object-cover shadow-[0_0_0_5px_hsl(var(--accent)/0.18)]"
        />
      </div>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 max-w-[560px] sm:pr-24">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
            Build your menu
          </p>
          <h1 className="mt-1 font-serif text-[30px] font-bold leading-[1.05] text-white sm:text-[34px]">
            Build Your Own Package
          </h1>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-white/75">
            Choose your favourite dishes and customize a menu that fits your
            occasion.
          </p>
        </div>
        <div className="relative shrink-0 sm:w-[244px] [&>div]:border-white/15 [&>div]:bg-white/95">
          <GuestStepper
            guestCount={guestCount}
            guestInput={guestInput}
            minGuestCount={config?.minGuestCount ?? MIN_GUESTS}
            maxGuestCount={config?.maxGuestCount}
            onInputBlur={handleGuestBlur}
            onInputChange={handleGuestInput}
            onStep={(delta) => setClampedGuestCount(guestCount + delta)}
          />
        </div>
      </div>
    </div>
  );

  const summary = (
    <SummaryPanel
      estimatedSubtotal={estimatedSubtotal}
      guestCount={guestCount}
      message={message}
      nonVegCount={nonVegCount}
      onAddToCart={addToCart}
      onViewSummary={() => setSummaryOpen(true)}
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
          <h1 className="font-serif text-2xl font-bold text-foreground">
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
    <main className="min-h-screen overflow-x-clip bg-background pb-28 lg:pb-16">
      <div className="lg:hidden">
        <div className="mx-auto grid max-w-[720px] grid-cols-2 gap-1 px-4 py-3">
          {[
            ['dishes', 'Add Dishes'],
            ['summary', 'Summary'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id as MobileTab)}
              className={cn(
                'min-h-11 rounded-full border px-2 text-xs font-extrabold transition',
                mobileTab === id
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5 lg:px-6">
        {builderHeader}
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div
            className={cn(
              mobileTab === 'dishes' ? 'block' : 'hidden',
              'lg:block',
            )}
          >
            {catalogue}
          </div>
          <div
            className={cn(
              mobileTab === 'summary' ? 'block' : 'hidden',
              'lg:block',
            )}
          >
            {summary}
          </div>
        </div>
      </div>

      {summaryOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setSummaryOpen(false)}
            aria-label="Close menu summary"
          />
          <section className="relative flex max-h-[min(720px,90dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b p-5">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src="/logo.png"
                  alt="The Feast Factory"
                  className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm"
                />
                <div className="min-w-0">
                  <p className="eyebrow text-primary">Custom menu</p>
                  <h2 className="mt-1 font-serif text-2xl font-bold">
                    Order summary
                  </h2>
                  <p className="numeric-text mt-1 text-sm text-muted-foreground">
                    {guestCount} guests · {order.length} selected items
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border"
                aria-label="Close menu summary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
              <div className="divide-y rounded-xl border">
                {order.map((id) => {
                  const dish = dishMap[id];
                  if (!dish) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-4 p-3"
                    >
                      <Image
                        src={getDishImage(dish)}
                        alt=""
                        width={56}
                        height={48}
                        sizes="56px"
                        className="h-12 w-14 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {dish.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dish.categoryName}
                        </p>
                      </div>
                      <span className="numeric-text shrink-0 text-sm font-semibold">
                        {formatCurrency(dish.price)} / guest
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0 border-t bg-[#fffdf8] p-5">
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Estimated total
                </span>
                <strong className="numeric-text text-2xl">
                  {formatCurrency(estimatedSubtotal)}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSummaryOpen(false);
                  void addToCart();
                }}
                disabled={saving}
                className="mt-4 min-h-11 w-full rounded-full bg-primary px-4 text-sm font-extrabold text-white disabled:bg-primary/35"
              >
                {saving ? 'Adding...' : 'Add to Cart'}
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white p-3 shadow-[0_-8px_24px_rgba(45,31,20,0.10)] lg:hidden">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground">
              {order.length} selected for {guestCount} guests
            </p>
            <p className="truncate font-serif text-xl font-bold text-primary">
              {estimatedSubtotal
                ? formatCurrency(estimatedSubtotal)
                : 'Select dishes'}
            </p>
          </div>
          <button
            type="button"
            disabled={order.length === 0 || saving}
            onClick={addToCart}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-white disabled:bg-primary/35"
          >
            {saving ? 'Adding...' : 'Add to Cart'}{' '}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </main>
  );
}
