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
import { orderByKgImage } from '../../lib/catalog-display';
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
  const clearSelections = useOrderBuilderStore(
    (state) => state.clearSelections,
  );
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [weights, setWeights] = useState<Weights>({});
  const [search, setSearch] = useState('');
  const [diet, setDiet] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [quote, setQuote] = useState<KgQuote>();
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedCartId = useRef<string | null>(requestedCart);
  const discardStaleCart = useCallback(() => {
    savedCartId.current = null;
    setDbCartId(undefined);
    clearSelections();
    const next = new URLSearchParams(params.toString());
    next.delete('cartId');
    const query = next.toString();
    router.replace(query ? `/order-by-kg?${query}` : '/order-by-kg');
  }, [clearSelections, params, router, setDbCartId]);
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
    savedCartId.current = requestedCart;
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
        discardStaleCart();
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

  const groups =
    config?.categoryRules
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
      .filter((rule) => rule.items.length) ?? [];
  const quoteById = new Map(
    quote?.items.map((item) => [item.menuItemId, item]) ?? [],
  );
  return (
    <main className="min-h-screen overflow-x-clip bg-background pb-28 lg:pb-10">
      <section className="relative isolate overflow-hidden border-b bg-hero-end text-white">
        <img
          src={orderByKgImage}
          alt="Indian dishes prepared in bulk beside a weighing scale"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[62%_center] sm:object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--hero-end)/0.99)_0%,hsl(var(--hero-start)/0.94)_40%,hsl(var(--hero-start)/0.30)_72%,rgba(0,0,0,0.08)_100%)]" />
        <div className="container-pad flex min-h-[156px] items-center py-4 sm:min-h-[280px] sm:py-7 lg:min-h-[330px] lg:px-16 lg:py-9">
          <div className="max-w-[620px]">
            <p className="eyebrow">Flexible bulk catering</p>
            <h1 className="mt-1.5 font-serif text-[30px] font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-[42px] lg:text-[48px]">
              Order <span className="text-accent">by KG</span>
            </h1>
            <p className="mt-2 max-w-[520px] text-xs font-semibold leading-5 text-white/85 sm:mt-3 sm:text-lg sm:leading-6">
              Choose your favourite dishes for your gathering, priced by kg.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-white/80 sm:mt-5 sm:grid sm:max-w-[600px] sm:grid-cols-4 sm:gap-2 sm:text-[11px]">
              {[
                { label: 'Priced per kg', icon: Scale },
                { label: 'Bulk portions', icon: Plus },
                { label: 'Freshly prepared', icon: Leaf },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-1 whitespace-nowrap sm:min-h-10 sm:rounded-lg sm:border sm:border-white/10 sm:bg-black/15 sm:px-2.5 sm:py-2 sm:font-extrabold sm:text-white sm:backdrop-blur-sm"
                >
                  <Icon
                    className="hidden h-[18px] w-[18px] shrink-0 text-accent sm:block"
                    aria-hidden="true"
                  />
                  {label}
                  {label !== 'Freshly prepared' && (
                    <span className="text-white/50 sm:hidden" aria-hidden="true">·</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
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
          <div className="grid items-start gap-6">
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
              <div className="mb-3 grid grid-cols-[minmax(0,1fr)_136px] gap-2 sm:mb-4 sm:flex sm:flex-wrap sm:gap-3">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="Search dishes"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search dishes"
                    className="h-10 pl-9"
                  />
                </div>
                <select
                  aria-label="Diet preference"
                  className="h-10 rounded-lg border bg-card px-3 text-sm"
                  value={diet}
                  onChange={(event) => setDiet(event.target.value)}
                >
                  <option value="ALL">All dishes</option>
                  <option value="VEG">Vegetarian</option>
                  <option value="NON_VEG">Non-vegetarian</option>
                </select>
              </div>
              <nav
                aria-label="Dish categories"
                className="mb-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {groups.map((rule) => (
                  <a
                    key={rule.id}
                    href={`#kg-category-${rule.id}`}
                    className="min-h-9 shrink-0 rounded-md border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {rule.category.name}
                  </a>
                ))}
              </nav>
              {!groups.length && (
                <p className="rounded-xl border bg-card p-5 text-sm">
                  No dishes match your search.
                </p>
              )}
              {groups.map((rule) => (
                <section key={rule.id} id={`kg-category-${rule.id}`} className="mb-5 scroll-mt-4 sm:mb-7">
                  <div className="mb-2 flex items-baseline justify-between gap-3 sm:mb-3">
                    <h2 className="font-sans text-xs font-bold uppercase tracking-[0.08em] text-primary sm:text-sm">
                      {rule.category.name}
                    </h2>
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                      {rule.items.length}{' '}
                      {rule.items.length === 1 ? 'dish' : 'dishes'}
                    </span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
                    {rule.items.map((item) => (
                      <article
                        key={item.id}
                        className="group grid min-h-[116px] grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/80 bg-card transition-colors hover:border-primary/30 sm:min-h-[132px]"
                      >
                        <div className="relative h-full min-h-[116px] overflow-hidden sm:min-h-[132px]">
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
