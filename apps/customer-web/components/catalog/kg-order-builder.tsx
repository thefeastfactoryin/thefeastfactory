'use client';
import { MobileOrderBar } from '../mobile-order-bar';

import type {
  CartSummary,
  PackageConfiguration,
  PackageSelectionPrice,
  PackageSummary,
} from '@aranyam/shared-types';
import {
  ArrowRight,
  Flame,
  Leaf,
  Minus,
  Plus,
  Scale,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import {
  isClearedCartError,
  subscribeToCartCleared,
} from '../../lib/cart-state';
import { formatCurrency } from '../../lib/format';
import { sortMenuCategories } from '../../lib/menu-category-order';
import { orderByKgImage } from '../../lib/catalog-display';
import { cn } from '../../lib/utils';
import { useSessionStore } from '../../store/session.store';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { useDeliveryLocationStore } from '../../store/delivery-location.store';
import { DataImage } from '../data-image';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type Weights = Record<string, number>;
type KgQuote = PackageSelectionPrice & {
  items: Array<PackageSelectionPrice['items'][number]>;
};

const FALLBACK_DEFAULT_WEIGHT_GRAMS = 1000;
const FALLBACK_WEIGHT_INCREMENT_GRAMS = 500;
const MAX_WEIGHT_GRAMS = 100000;

function formatWeightKg(grams: number) {
  return Number((grams / 1000).toFixed(1));
}

export function KgOrderBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedVersion = params.get('packageVersionId');
  const requestedCart = params.get('cartId');
  const session = useSessionStore((state) => state.session);
  const location = useDeliveryLocationStore((state) => state.location);
  const regionId = location?.resolution.region?.id;
  const hydrate = useOrderBuilderStore((state) => state.hydrateFromCart);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [weights, setWeights] = useState<Weights>({});
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [diet, setDiet] = useState('ALL');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [quote, setQuote] = useState<KgQuote>();
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedCartId = useRef<string | null>(requestedCart);
  const lastUrlCartId = useRef(requestedCart);
  const weightsRef = useRef(weights);
  const configIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    weightsRef.current = weights;
  }, [weights]);
  useEffect(() => {
    if (lastUrlCartId.current === requestedCart) return;
    lastUrlCartId.current = requestedCart;
    savedCartId.current = requestedCart;
  }, [requestedCart]);
  const discardStaleCart = useCallback(() => {
    if (configIdRef.current && Object.keys(weightsRef.current).length) {
      sessionStorage.setItem(
        `kg-draft:${configIdRef.current}`,
        JSON.stringify(weightsRef.current),
      );
    }
    savedCartId.current = null;
    setDbCartId(undefined);
    const next = new URLSearchParams(params.toString());
    next.delete('cartId');
    const query = next.toString();
    router.replace(query ? `/order-by-kg?${query}` : '/order-by-kg');
  }, [params, router, setDbCartId]);
  const defaultWeightGrams =
    config?.kgDefaultWeightGrams ?? FALLBACK_DEFAULT_WEIGHT_GRAMS;
  const weightIncrementGrams =
    config?.kgWeightIncrementGrams ?? FALLBACK_WEIGHT_INCREMENT_GRAMS;
  const maximumWeightGrams =
    defaultWeightGrams +
    Math.floor((MAX_WEIGHT_GRAMS - defaultWeightGrams) / weightIncrementGrams) *
      weightIncrementGrams;

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setConfig(undefined);
    setQuote(undefined);
    (async () => {
      const rows = (
        await apiRequest<PackageSummary[]>(
          `/packages${regionId ? `?regionId=${regionId}` : ''}`,
        )
      ).filter((pkg) => pkg.type === 'ORDER_BY_KG' && pkg.activeVersion);
      if (!current) return;
      setPackages(rows);
      let versionId = requestedVersion ?? rows[0]?.activeVersion?.id;
      let cart: CartSummary | undefined;
      if (requestedCart) {
        if (!session) {
          router.replace(
            `/login?returnTo=${encodeURIComponent(`/order-by-kg?${params.toString()}`)}`,
          );
          return;
        }
        cart = await apiRequest<CartSummary>(
          `/cart/${requestedCart}`,
          {},
          session.accessToken,
        );
        if (
          cart.package.type !== 'ORDER_BY_KG' ||
          (requestedVersion && cart.packageVersionId !== requestedVersion)
        )
          throw new Error('This cart does not match the selected KG menu.');
        versionId = cart.packageVersionId;
      }
      if (!versionId) return;
      const next = await apiRequest<PackageConfiguration>(
        `/package-versions/${versionId}/configuration${regionId ? `?regionId=${regionId}` : ''}`,
      );
      if (next.packageType !== 'ORDER_BY_KG')
        throw new Error('Choose an Order by KG menu.');
      if (!current) return;
      configIdRef.current = next.id;
      setConfig(next);
      const nextDefaultWeightGrams =
        next.kgDefaultWeightGrams ?? FALLBACK_DEFAULT_WEIGHT_GRAMS;
      const nextWeightIncrementGrams =
        next.kgWeightIncrementGrams ?? FALLBACK_WEIGHT_INCREMENT_GRAMS;
      let initial: Weights = {};
      if (cart) {
        initial = Object.fromEntries(
          cart.items.map((item) => [
            item.menuItemId,
            item.weightGrams ?? nextDefaultWeightGrams,
          ]),
        );
      } else {
        try {
          initial = JSON.parse(
            sessionStorage.getItem(`kg-draft:${next.id}`) || '{}',
          );
        } catch {
          initial = {};
        }
      }
      const allowed = new Set(
        next.categoryRules.flatMap((rule) => rule.items.map((item) => item.id)),
      );
      setWeights(
        Object.fromEntries(
          Object.entries(initial).filter(
            ([id, grams]) =>
              allowed.has(id) &&
              Number.isInteger(grams) &&
              grams >= nextDefaultWeightGrams &&
              grams <= MAX_WEIGHT_GRAMS &&
              (grams - nextDefaultWeightGrams) % nextWeightIncrementGrams === 0,
          ),
        ),
      );
    })()
      .catch((reason: Error) => {
        if (!current) return;
        if (isClearedCartError(reason)) {
          discardStaleCart();
          return;
        }
        setError(reason.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    discardStaleCart,
    regionId,
    requestedCart,
    requestedVersion,
    session?.accessToken,
  ]);

  useEffect(
    () => subscribeToCartCleared(discardStaleCart),
    [discardStaleCart],
  );

  const selectedItems = useMemo(
    () =>
      config?.categoryRules.flatMap((rule) =>
        rule.items
          .filter((item) => weights[item.id])
          .map((item) => ({
            categoryId: rule.category.id,
            menuItemId: item.id,
            role: 'CUSTOM' as const,
            quantity: 1,
            weightGrams: weights[item.id],
          })),
      ) ?? [],
    [config, weights],
  );

  useEffect(() => {
    if (!config || loading) return;
    if (!requestedCart)
      sessionStorage.setItem(`kg-draft:${config.id}`, JSON.stringify(weights));
    setQuote(undefined);
    setQuoteError('');
    if (!selectedItems.length) {
      setQuoting(false);
      return;
    }
    let current = true;
    setQuoting(true);
    const timer = window.setTimeout(() => {
      apiRequest<KgQuote>(`/package-versions/${config.id}/preview-quote`, {
        method: 'POST',
        body: JSON.stringify({
          guestCount: 1,
          selectedItems,
          ...(regionId ? { regionId } : {}),
        }),
      })
        .then((next) => {
          if (current) setQuote(next);
        })
        .catch((reason: Error) => {
          if (current) setQuoteError(reason.message);
        })
        .finally(() => {
          if (current) setQuoting(false);
        });
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [config, selectedItems, weights, loading, requestedCart, regionId]);

  function changeWeight(id: string, grams: number) {
    setQuote(undefined);
    setWeights((current) => {
      const next = { ...current };
      if (grams < defaultWeightGrams) delete next[id];
      else
        next[id] = Math.min(
          maximumWeightGrams,
          Math.max(defaultWeightGrams, grams),
        );
      return next;
    });
  }

  async function save() {
    if (!config || !quote || quoting || saving || !selectedItems.length) return;
    if (!session) {
      sessionStorage.setItem(`kg-draft:${config.id}`, JSON.stringify(weights));
      router.push(
        `/login?returnTo=${encodeURIComponent(`/order-by-kg?packageVersionId=${config.id}`)}`,
      );
      return;
    }
    setSaving(true);
    setError('');
    try {
      const createCart = () =>
        apiRequest<CartSummary>(
          '/cart',
          {
            method: 'POST',
            body: JSON.stringify({
              packageVersionId: config.id,
              ...(location?.resolution.serviceable && location.resolution.region
                ? { regionId: location.resolution.region.id }
                : {}),
            }),
          },
          session.accessToken,
        );
      if (!savedCartId.current) {
        const created = await createCart();
        savedCartId.current = created.id;
      }
      let cart: CartSummary;
      try {
        cart = await apiRequest<CartSummary>(
          `/cart/${savedCartId.current}/items`,
          { method: 'PUT', body: JSON.stringify({ items: selectedItems }) },
          session.accessToken,
        );
      } catch (reason) {
        if (!isClearedCartError(reason)) throw reason;
        savedCartId.current = null;
        setDbCartId(undefined);
        const created = await createCart();
        savedCartId.current = created.id;
        cart = await apiRequest<CartSummary>(
          `/cart/${created.id}/items`,
          { method: 'PUT', body: JSON.stringify({ items: selectedItems }) },
          session.accessToken,
        );
      }
      hydrate(cart);
      sessionStorage.removeItem(`kg-draft:${config.id}`);
      window.dispatchEvent(new Event('cart-updated'));
      router.push('/cart');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = sortMenuCategories(
    config?.categoryRules.map((rule) => rule.category) ?? [],
    (cat) => cat.name,
  ).filter(
    (cat, index, all) => all.findIndex((other) => other.id === cat.id) === index,
  );
  const groups = sortMenuCategories(
    config?.categoryRules
      .filter((rule) => !category || rule.category.id === category)
      .map((rule) => ({
        ...rule,
        items: rule.items.filter(
          (item) =>
            `${item.name} ${rule.category.name}`
              .toLowerCase()
              .includes(search.toLowerCase()) &&
            (diet === 'ALL' || (diet === 'VEG' ? item.isVeg : !item.isVeg)),
        ),
      }))
      .filter((rule) => rule.items.length) ?? [],
    (rule) => rule.category.name,
  );
  const quoteById = new Map(
    quote?.items.map((item) => [item.menuItemId, item]) ?? [],
  );
  return (
    <main className="min-h-screen overflow-x-clip bg-background pb-28 lg:pb-10">
      <section className="relative isolate hidden overflow-hidden border-b bg-hero-end text-white sm:block">
        <img
          src={orderByKgImage}
          alt="Indian dishes prepared in bulk beside a weighing scale"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[62%_center] sm:object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--hero-end)/0.99)_0%,hsl(var(--hero-start)/0.94)_40%,hsl(var(--hero-start)/0.30)_72%,rgba(0,0,0,0.08)_100%)]" />
        <div className="container-pad flex min-h-[238px] items-center py-5 sm:min-h-[330px] sm:py-7 lg:min-h-[360px] lg:px-16 lg:py-9">
          <div className="max-w-[620px]">
            <p className="eyebrow">Flexible bulk catering</p>
            <h1 className="mt-2 font-serif text-[30px] font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-[42px] lg:text-[48px]">
              Order <span className="text-accent">by KG</span>
            </h1>
            <p className="mt-3 hidden max-w-[520px] text-base font-semibold leading-6 text-white/85 sm:block sm:text-lg">
              Choose your favourite dishes for your gathering, priced by kg.
            </p>
            <div className="mt-4 grid max-w-[600px] grid-cols-2 gap-1.5 sm:mt-5 sm:grid-cols-3 sm:gap-2">
              {[
                { label: 'Priced per kg', icon: Scale },
                { label: 'Bulk portions', icon: Plus },
                { label: 'Freshly prepared', icon: Leaf },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-2.5 py-1.5 text-white backdrop-blur-sm sm:min-h-11 sm:py-2"
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
      <section className="border-b border-border bg-background px-4 pb-3 pt-2 sm:hidden">
        <h1 className="font-sans text-[22px] font-semibold leading-[1.12] tracking-[-0.015em] text-charcoal">
          Order by KG
        </h1>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-muted-foreground">
          Choose your favourite dishes for your gathering, priced by kg.
        </p>
      </section>
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-5 lg:px-10">
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Loading dishes…</p>
        ) : !config ||
          !config.categoryRules.some((rule) => rule.items.length) ? (
          <section className="rounded-2xl border bg-card p-8">
            <h2 className="font-sans text-2xl font-semibold">
              {error
                ? 'Unable to load this menu'
                : 'No dishes available by kg right now'}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Please check back soon, or explore our meal boxes and packages.
            </p>
            <Link
              href="/packages"
              className="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-primary"
            >
              View packages <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              {packages.length > 1 && !requestedCart && (
                <label className="mb-4 block text-sm font-semibold">
                  KG menu
                  <select
                    className="mt-2 block min-h-11 w-full rounded-xl border bg-card px-3"
                    value={config.id}
                    onChange={(event) =>
                      router.push(
                        `/order-by-kg?packageVersionId=${event.target.value}`,
                      )
                    }
                  >
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.activeVersion!.id}>
                        {pkg.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { value: 'ALL', label: 'All' },
                      { value: 'VEG', label: 'Veg' },
                      { value: 'NON_VEG', label: 'Non-veg' },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDiet(value)}
                      className={cn(
                        'min-h-8 rounded-full border px-3 py-1 text-xs font-bold transition-colors',
                        diet === value
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-expanded={searchOpen}
                  aria-label={searchOpen ? 'Close dish search' : 'Search dishes'}
                  onClick={() => {
                    if (searchOpen) setSearch('');
                    setSearchOpen((open) => !open);
                  }}
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full border transition',
                    searchOpen
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
                  )}
                >
                  {searchOpen ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div
                aria-hidden={!searchOpen}
                className={cn(
                  'grid transition-all duration-200 ease-out',
                  searchOpen
                    ? 'mb-3 grid-rows-[1fr] opacity-100 sm:mb-4'
                    : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden">
                  <div className="relative min-w-0">
                    <Search
                      className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      aria-label="Search dishes"
                      tabIndex={searchOpen ? 0 : -1}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search dishes"
                      className="h-10 pl-9"
                    />
                  </div>
                </div>
              </div>
              <nav
                aria-label="Dish categories"
                className="mb-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <button
                  type="button"
                  onClick={() => setCategory('')}
                  className={cn(
                    'min-h-9 shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                    !category
                      ? 'border-primary bg-primary text-white'
                      : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
                  )}
                >
                  All dishes
                </button>
                {categoryOptions.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={cn(
                      'min-h-9 shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                      category === cat.id
                        ? 'border-primary bg-primary text-white'
                        : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary',
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </nav>
              {!groups.length && (
                <p className="rounded-xl border bg-card p-5 text-sm">
                  No dishes match your search.
                </p>
              )}
              {groups.map((rule) => (
                <section key={rule.id} className="mb-5 sm:mb-7">
                  <div className="mb-2 flex items-baseline gap-2 sm:mb-3">
                    <h2 className="font-sans text-xs font-bold uppercase tracking-[0.08em] text-primary sm:text-sm">
                      {rule.category.name}
                    </h2>
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                      · {rule.items.length}{' '}
                      {rule.items.length === 1 ? 'dish' : 'dishes'}
                    </span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(260px,340px))] sm:gap-4 lg:grid-cols-[repeat(auto-fit,minmax(360px,1fr))]">
                    {rule.items.map((item) => (
                      <article
                        key={item.id}
                        className="group grid min-h-[116px] grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/80 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover sm:min-h-[132px] lg:min-h-[156px] lg:grid-cols-[132px_minmax(0,1fr)]"
                      >
                        <div className="relative h-full min-h-[116px] overflow-hidden sm:min-h-[132px] lg:min-h-[156px]">
                          <DataImage
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5 sm:p-3">
                          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground sm:text-base">
                            {item.name}
                          </h3>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="money-text whitespace-nowrap text-sm font-bold leading-none text-primary sm:text-base">
                              {formatCurrency(item.pricePerKg).replace(/\.00$/, '')}{' '}
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                / kg
                              </span>
                            </p>
                            {quoteById.get(item.id)?.lineTotal && (
                              <span className="money-text shrink-0 text-xs font-bold text-foreground">
                                {formatCurrency(
                                  quoteById.get(item.id)!.lineTotal,
                                )}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                              {item.isVeg ? <Leaf className="h-3 w-3 text-emerald-700" aria-hidden="true" /> : <Flame className="h-3 w-3 text-orange-600" aria-hidden="true" />}
                              {item.isVeg ? 'Veg' : 'Non-veg'}
                            </span>
                            {weights[item.id] ? (
                              <div className="flex h-9 items-center rounded-md border bg-background">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() =>
                                    changeWeight(
                                      item.id,
                                      weights[item.id] - weightIncrementGrams,
                                    )
                                  }
                                  aria-label={`Decrease ${item.name} weight by ${formatWeightKg(weightIncrementGrams)} kilograms`}
                                  className="grid h-9 w-8 place-items-center text-primary disabled:opacity-40"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="min-w-11 text-center text-xs font-bold sm:min-w-14 sm:text-sm">
                                  {weights[item.id] / 1000} kg
                                </span>
                                <button
                                  type="button"
                                  disabled={
                                    saving ||
                                    weights[item.id] >= maximumWeightGrams
                                  }
                                  onClick={() =>
                                    changeWeight(
                                      item.id,
                                      weights[item.id] + weightIncrementGrams,
                                    )
                                  }
                                  aria-label={`Increase ${item.name} weight by ${formatWeightKg(weightIncrementGrams)} kilograms`}
                                  className="grid h-9 w-8 place-items-center text-primary disabled:opacity-40"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={saving}
                                onClick={() =>
                                  changeWeight(item.id, defaultWeightGrams)
                                }
                                className="h-9 px-2.5 text-xs"
                              >
                                Add{' '}
                                <Plus className="ml-1.5 h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <aside className="hidden lg:sticky lg:top-24 lg:block">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_8px_22px_rgba(45,31,20,0.045)]">
                <p className="eyebrow text-primary">Live Summary</p>
                <h2 className="mt-1 font-sans text-xl font-semibold">
                  Your order
                </h2>
                {selectedItems.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-border bg-[#fbf8f2] p-3 text-sm">
                    <p className="font-bold text-foreground">
                      No dishes added yet
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Add dishes by weight to build your order.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        {selectedItems.length}{' '}
                        {selectedItems.length === 1 ? 'dish' : 'dishes'} selected
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 rounded-xl bg-primary/[0.055] p-2.5">
                      <span className="font-extrabold text-primary">
                        Estimated total
                      </span>
                      <strong className="money-text text-primary">
                        {quoting
                          ? 'Updating…'
                          : quote
                            ? formatCurrency(quote.totalAmount)
                            : '-'}
                      </strong>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Excluding taxes
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  disabled={!quote || quoting || saving || !selectedItems.length}
                  onClick={() => void save()}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-extrabold text-white transition hover:bg-primary/90 disabled:bg-primary/35"
                >
                  {saving
                    ? 'Saving…'
                    : requestedCart
                      ? 'Update cart'
                      : 'View cart'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                {selectedItems.length === 0 && (
                  <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
                    Add at least one dish to continue.
                  </p>
                )}
                {quoteError && (
                  <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-xs font-semibold text-red-800">
                    {quoteError}
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
      {config && selectedItems.length > 0 && (
        <MobileOrderBar label="Order by KG total and cart">
          <div className="mobile-order-bar-row">
            <div className="mobile-order-bar-summary">
              <span className="mobile-order-bar-label">
                {selectedItems.length}{' '}
                {selectedItems.length === 1 ? 'dish' : 'dishes'} selected
              </span>
              <span className="mobile-order-bar-total">
                {quoting
                  ? 'Updating…'
                  : quote
                    ? formatCurrency(quote.totalAmount).replace(/\.00$/, '')
                    : 'Updating total'}
              </span>
            </div>
            <Button
              className="mobile-order-bar-action"
              disabled={!quote || quoting || saving || !selectedItems.length}
              onClick={() => void save()}
            >
              {saving
                ? 'Saving…'
                : requestedCart
                  ? 'Update cart'
                  : 'View cart'}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {quoteError && (
            <p
              role="alert"
              className="mx-auto mt-1 max-w-2xl text-xs text-red-700"
            >
              {quoteError}
            </p>
          )}
        </MobileOrderBar>
      )}
    </main>
  );
}
