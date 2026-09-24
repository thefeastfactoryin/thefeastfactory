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
  ChefHat,
  Flame,
  Leaf,
  Minus,
  Plus,
  Scale,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
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
        if (current) setError(reason.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [requestedVersion, requestedCart, session?.accessToken, regionId]);

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
      if (!savedCartId.current) {
        const created = await apiRequest<CartSummary>(
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
        savedCartId.current = created.id;
      }
      const cart = await apiRequest<CartSummary>(
        `/cart/${savedCartId.current}/items`,
        { method: 'PUT', body: JSON.stringify({ items: selectedItems }) },
        session.accessToken,
      );
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
    <main className="min-h-screen overflow-x-clip bg-background pb-28 lg:pb-10 sm:[font-family:var(--font-package-sans),sans-serif]">
      <section className="relative isolate overflow-hidden border-b bg-hero-end text-white">
        <img
          src={orderByKgImage}
          alt="Indian dishes prepared in bulk beside a weighing scale"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[62%_center] sm:object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--hero-end)/0.99)_0%,hsl(var(--hero-start)/0.94)_40%,hsl(var(--hero-start)/0.30)_72%,rgba(0,0,0,0.08)_100%)]" />
        <div className="container-pad flex min-h-[238px] items-center py-5 sm:min-h-[330px] sm:py-7 lg:min-h-[360px] lg:px-16 lg:py-9">
          <div className="max-w-[620px]">
            <p className="eyebrow">Flexible bulk catering</p>
            <h1 className="mt-2 font-serif text-[36px] font-bold leading-[0.95] tracking-tight text-white sm:text-[54px] lg:text-[64px]">
              Order <span className="text-accent">by KG</span>
            </h1>
            <p className="mt-3 hidden max-w-[520px] text-base font-semibold leading-6 text-white/85 sm:block sm:text-lg">
              Choose your dishes by weight with clear, itemised pricing.
            </p>
            <div className="mt-4 grid max-w-[600px] grid-cols-2 gap-1.5 sm:mt-5 sm:grid-cols-4 sm:gap-2">
              {[
                { label: 'Priced per kg', icon: Scale },
                { label: 'Bulk portions', icon: Plus },
                { label: 'Made for groups', icon: ChefHat },
                { label: 'Freshly prepared', icon: Leaf },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-2.5 py-1.5 text-[11px] font-extrabold leading-tight text-white backdrop-blur-sm sm:min-h-11 sm:py-2"
                >
                  <Icon
                    className="h-[18px] w-[18px] shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  {label}
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
            <h2 className="font-serif text-2xl font-bold">
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
              <div className="mb-5 grid grid-cols-[minmax(0,1fr)_136px] gap-2 sm:mb-6 sm:flex sm:flex-wrap sm:gap-3">
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
                    className="pl-9"
                  />
                </div>
                <select
                  aria-label="Diet preference"
                  className="min-h-11 rounded-xl border bg-card px-3 text-sm"
                  value={diet}
                  onChange={(event) => setDiet(event.target.value)}
                >
                  <option value="ALL">All dishes</option>
                  <option value="VEG">Vegetarian</option>
                  <option value="NON_VEG">Non-vegetarian</option>
                </select>
              </div>
              {!groups.length && (
                <p className="rounded-xl border bg-card p-5 text-sm">
                  No dishes match your search.
                </p>
              )}
              {groups.map((rule) => (
                <section key={rule.id} className="mb-7">
                  <div className="mb-3 flex items-baseline justify-between gap-3 sm:mb-4">
                    <h2 className="font-serif text-xl font-bold sm:text-2xl">
                      {rule.category.name}
                    </h2>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                      {rule.items.length}{' '}
                      {rule.items.length === 1 ? 'dish' : 'dishes'}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    {rule.items.map((item) => (
                      <article
                        key={item.id}
                        className="group grid min-h-[148px] grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_4px_18px_rgba(0,0,0,0.06)] transition-all hover:border-primary/20 hover:shadow-[0_10px_28px_rgba(0,0,0,0.10)] sm:flex sm:flex-col"
                      >
                        <div className="relative h-full min-h-[148px] overflow-hidden sm:h-40 sm:min-h-0">
                          <DataImage
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          />
                          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/35 to-transparent" />
                          <span
                            className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-extrabold text-white shadow-sm ${
                              item.isVeg ? 'bg-emerald-600' : 'bg-orange-500'
                            }`}
                          >
                            {item.isVeg ? (
                              <Leaf
                                className="h-2.5 w-2.5"
                                aria-hidden="true"
                              />
                            ) : (
                              <Flame
                                className="h-2.5 w-2.5"
                                aria-hidden="true"
                              />
                            )}
                            {item.isVeg ? 'Veg' : 'Non-veg'}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
                          <h3 className="text-[20px] font-bold leading-[1.12] text-foreground [font-family:var(--font-package-heading),serif]">
                            {item.name}
                          </h3>
                          <div className="mt-1.5 flex items-baseline justify-between gap-2 sm:mt-2">
                            <p className="whitespace-nowrap text-lg font-extrabold leading-none text-primary">
                              {formatCurrency(item.pricePerKg)}{' '}
                              <span className="text-[11px] font-semibold text-muted-foreground">
                                / kg
                              </span>
                            </p>
                            {quoteById.get(item.id)?.lineTotal && (
                              <span className="shrink-0 text-sm font-extrabold text-foreground">
                                {formatCurrency(
                                  quoteById.get(item.id)!.lineTotal,
                                )}
                              </span>
                            )}
                          </div>
                          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary/[0.06] px-2 py-1 text-[9px] font-bold text-primary sm:text-[10px]">
                            <Scale className="h-3 w-3" aria-hidden="true" />
                            Bulk portions
                          </span>
                          <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-2 pt-2.5 sm:pt-4">
                            {weights[item.id] ? (
                              <div className="flex items-center rounded-xl border bg-background">
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
                                  className="grid h-11 w-11 place-items-center text-primary disabled:opacity-40"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="min-w-12 text-center text-xs font-bold sm:min-w-16 sm:text-sm">
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
                                  className="grid h-11 w-11 place-items-center text-primary disabled:opacity-40"
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
                                className="h-11 px-3"
                              >
                                Add {formatWeightKg(defaultWeightGrams)} kg{' '}
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
            <aside className="rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
              <h2 className="font-serif text-2xl font-bold">Your selection</h2>
              <div className="mt-4 space-y-3" aria-live="polite">
                {quote?.items.map((item) => (
                  <div key={item.menuItemId} className="border-b pb-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{item.menuItemName}</span>
                      <strong>{formatCurrency(item.lineTotal)}</strong>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(item.weightGrams ?? 0) / 1000} kg ×{' '}
                      {formatCurrency(item.pricePerKg)} / kg
                    </p>
                  </div>
                ))}
                {quoting && (
                  <p role="status" className="text-sm">
                    Updating total…
                  </p>
                )}
                {quoteError && (
                  <p role="alert" className="text-sm text-red-700">
                    {quoteError}
                  </p>
                )}
              </div>
              <div className="mt-5 flex justify-between font-bold">
                <span>Food subtotal</span>
                <span>{quote ? formatCurrency(quote.totalAmount) : '—'}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Excluding delivery.
              </p>
              <Button
                className="mt-5 w-full"
                disabled={!quote || quoting || saving || !selectedItems.length}
                onClick={() => void save()}
              >
                {saving
                  ? 'Saving…'
                  : session
                    ? requestedCart
                      ? 'Update cart'
                      : 'Add to cart'
                    : 'Sign in to continue'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </aside>
          </div>
        )}
      </div>
      {config && (
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
                    ? formatCurrency(quote.totalAmount)
                    : 'Select dishes'}
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
                  : 'Add to cart'}
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
