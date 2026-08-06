'use client';

import type { PackageConfiguration } from '@aranyam/shared-types';
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  ChevronRight,
  Filter,
  Leaf,
  Lock,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { DataImage } from '../../../components/data-image';
import { Button } from '../../../components/ui/button';
import { StatePanel } from '../../../components/ui/state-panel';
import { apiRequest } from '../../../lib/api';
import { formatCurrency } from '../../../lib/format';
import { usePackagePreviewQuote } from '../../../lib/use-package-preview-quote';
import { cn } from '../../../lib/utils';
import {
  type SelectedItem,
  useOrderBuilderStore,
} from '../../../store/order-builder.store';
import { useSessionStore } from '../../../store/session.store';

type CategoryRule = PackageConfiguration['categoryRules'][number];
type MenuSelectionItem = CategoryRule['items'][number] & {
  ingredients?: string | null;
};
type MenuRow = { rule: CategoryRule; item: MenuSelectionItem };
type DetailItem = { item: MenuSelectionItem; categoryName: string };

export default function MenuSelectPage() {
  return (
    <Suspense
      fallback={
        <main className="page-shell">
          <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
        </main>
      }
    >
      <MenuSelectContent />
    </Suspense>
  );
}

function MenuSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cartPackage = useOrderBuilderStore((state) => state.package);
  const guestCount = useOrderBuilderStore((state) => state.guestCount);
  const setGuestCount = useOrderBuilderStore((state) => state.setGuestCount);
  const selectedItems = useOrderBuilderStore((state) => state.selectedItems);
  const setPackage = useOrderBuilderStore((state) => state.setPackage);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const toggleItem = useOrderBuilderStore((state) => state.toggleItem);
  const setSwap = useOrderBuilderStore((state) => state.setSwap);
  const updateItemQuantity = useOrderBuilderStore(
    (state) => state.updateItemQuantity,
  );
  const removeSwap = useOrderBuilderStore((state) => state.removeSwap);
  const session = useSessionStore((state) => state.session);

  const [config, setConfig] = useState<PackageConfiguration>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('all');
  const [menuDiet, setMenuDiet] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [extrasExpanded, setExtrasExpanded] = useState(false);
  const [expandedSwapId, setExpandedSwapId] = useState<string>();
  const [pendingSwapId, setPendingSwapId] = useState<string>();
  const [detailItem, setDetailItem] = useState<DetailItem>();
  const [saving, setSaving] = useState(false);
  const [boxCountInput, setBoxCountInput] = useState(String(guestCount));

  useEffect(() => setBoxCountInput(String(guestCount)), [guestCount]);

  useEffect(() => {
    const requestedVersionId = searchParams.get('packageVersionId');
    if (!requestedVersionId) return;
    if (cartPackage?.packageVersionId === requestedVersionId) return;

    apiRequest<PackageConfiguration>(
      `/package-versions/${requestedVersionId}/configuration`,
    )
      .then((configuration) => {
        setPackage({
          packageId: configuration.packageId,
          packageVersionId: configuration.id,
          packageName: configuration.packageName,
          packageType: configuration.packageType,
          isCustom: configuration.isCustom,
          basePricePerPlate: configuration.basePricePerPlate,
          minGuestCount: configuration.minGuestCount,
          maxGuestCount: configuration.maxGuestCount,
        });
        setConfig(configuration);
      })
      .catch((reason) => setError((reason as Error).message));
  }, [cartPackage?.packageVersionId, searchParams, setPackage]);

  useEffect(() => {
    if (!cartPackage?.packageVersionId) return;
    apiRequest<PackageConfiguration>(
      `/package-versions/${cartPackage.packageVersionId}/configuration`,
    )
      .then(setConfig)
      .catch((reason) => setError(reason.message));
  }, [cartPackage?.packageVersionId]);

  useEffect(() => {
    if (config?.packageType === 'CUSTOM_PACKAGE') {
      const next = new URLSearchParams();
      if (config.id) next.set('packageVersionId', config.id);
      router.replace(`/packages/build?${next.toString()}`);
    }
  }, [config?.id, config?.packageType, router]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('focus') === 'extras') {
      setExtrasExpanded(true);
    }
  }, []);

  const isMealBox = config?.packageType === 'MEAL_BOX';
  const supportsSwaps = config?.packageType !== 'CUSTOM_PACKAGE';
  const includedRows = useMemo<MenuRow[]>(() => {
    if (!config) return [];
    return config.categoryRules.flatMap((rule) =>
      rule.items
        .filter((item) => item.role === 'INCLUDED' && !item.swapForMenuItemId)
        .map((item) => ({ rule, item })),
    );
  }, [config]);
  const extraRows = useMemo<MenuRow[]>(() => {
    if (!config || config.packageType === 'MEAL_BOX') return [];
    return config.categoryRules.flatMap((rule) =>
      rule.items
        .filter((item) => item.role !== 'INCLUDED')
        .map((item) => ({ rule, item })),
    );
  }, [config]);
  const itemById = useMemo(() => {
    const entries =
      config?.categoryRules.flatMap((rule) =>
        rule.items.map((item) => [item.id, item] as const),
      ) ?? [];
    return new Map(entries);
  }, [config]);
  const selectedIds = useMemo(
    () => new Set(selectedItems.map((item) => item.menuItemId)),
    [selectedItems],
  );
  const selectedItemById = useMemo(
    () => new Map(selectedItems.map((item) => [item.menuItemId, item])),
    [selectedItems],
  );
  const selectedExtras = useMemo(
    () => extraRows.filter(({ item }) => selectedIds.has(item.id)),
    [extraRows, selectedIds],
  );

  const categories = useMemo(() => {
    if (!config) return [];
    return config.categoryRules
      .map((rule) => ({
        id: rule.category.id,
        name: rule.category.name,
        count: includedRows.filter(
          (row) => row.rule.category.id === rule.category.id,
        ).length,
      }))
      .filter(
        (category, index, rows) =>
          rows.findIndex((row) => row.id === category.id) === index,
      );
  }, [config, includedRows]);

  const matchesFilters = useCallback(
    ({ rule, item }: MenuRow) => {
      const query = menuSearch.trim().toLowerCase();
      return (
        (menuCategory === 'all' || rule.category.id === menuCategory) &&
        (menuDiet === 'all' || item.isVeg === (menuDiet === 'veg')) &&
        (!query ||
          `${item.name} ${item.description ?? ''} ${rule.category.name}`
            .toLowerCase()
            .includes(query))
      );
    },
    [menuCategory, menuDiet, menuSearch],
  );

  const visibleIncluded = useMemo(
    () => includedRows.filter(matchesFilters),
    [includedRows, matchesFilters],
  );
  const visibleExtras = useMemo(
    () => extraRows.filter(matchesFilters),
    [extraRows, matchesFilters],
  );
  const activeFilterCount =
    Number(menuCategory !== 'all') +
    Number(menuDiet !== 'all') +
    Number(Boolean(menuSearch.trim()));

  const currentSwaps = useMemo(
    () =>
      new Map(
        selectedItems
          .filter((item) => item.replacedMenuItemId)
          .map((item) => [item.replacedMenuItemId!, item]),
      ),
    [selectedItems],
  );

  const summaryRows = useMemo(
    () =>
      includedRows.map(({ rule, item }) => {
        const swap = currentSwaps.get(item.id);
        return {
          categoryName: rule.category.name,
          original: item,
          shown: swap ? (itemById.get(swap.menuItemId) ?? item) : item,
          swapped: Boolean(swap),
        };
      }),
    [currentSwaps, includedRows, itemById],
  );

  const preview = usePackagePreviewQuote({
    packageVersionId: cartPackage?.packageVersionId,
    guestCount,
    selectedItems,
  });
  const localPerPerson =
    Number(cartPackage?.basePricePerPlate ?? 0) +
    selectedItems.reduce(
      (total, item) =>
        total +
        (item.role === 'EXTRA'
          ? (Number(item.itemPrice || item.adjustmentAmount || 0) *
              (item.quantity ?? guestCount)) /
            Math.max(guestCount, 1)
          : Number(item.adjustmentAmount || 0)),
      0,
    );
  const basePerPerson = Number(
    preview.quote?.basePerPlatePrice ?? cartPackage?.basePricePerPlate ?? 0,
  );
  const menuSubtotal = Number(
    preview.quote?.totalAmount ?? localPerPerson * guestCount,
  );

  function alternativesFor(rule: CategoryRule, included: MenuSelectionItem) {
    return rule.items
      .filter((candidate) => candidate.swapForMenuItemId === included.id)
      .sort((left, right) => {
        const price =
          Number(left.adjustmentAmount) - Number(right.adjustmentAmount);
        return price || left.name.localeCompare(right.name);
      });
  }

  function openSwap(row: MenuRow) {
    const current = currentSwaps.get(row.item.id);
    setExpandedSwapId(row.item.id);
    setPendingSwapId(current?.menuItemId ?? row.item.id);
  }

  const activeSwapRow = useMemo(
    () => includedRows.find(({ item }) => item.id === expandedSwapId),
    [expandedSwapId, includedRows],
  );

  function closeSwap() {
    setExpandedSwapId(undefined);
    setPendingSwapId(undefined);
  }

  function confirmSwap(row: MenuRow) {
    if (!pendingSwapId || pendingSwapId === row.item.id) {
      removeSwap(row.item.id);
    } else {
      const alternative = alternativesFor(row.rule, row.item).find(
        (item) => item.id === pendingSwapId,
      );
      if (alternative) {
        setSwap({
          categoryId: row.rule.category.id,
          categoryName: row.rule.category.name,
          menuItemId: alternative.id,
          menuItemName: alternative.name,
          replacedMenuItemId: row.item.id,
          replacedMenuItemName: row.item.name,
          role: 'SWAP',
          itemPrice: alternative.itemPrice,
          includedValue: alternative.includedValue,
          adjustmentAmount: alternative.adjustmentAmount,
          isVeg: alternative.isVeg,
        });
      }
    }
    closeSwap();
  }

  function toggleExtra(row: MenuRow) {
    const changed = toggleItem(
      {
        categoryId: row.rule.category.id,
        categoryName: row.rule.category.name,
        menuItemId: row.item.id,
        menuItemName: row.item.name,
        role: 'EXTRA',
        itemPrice: row.item.itemPrice,
        includedValue: row.item.includedValue,
        adjustmentAmount: row.item.adjustmentAmount,
        quantity: guestCount,
        isVeg: row.item.isVeg,
      },
      row.rule.maxSelections,
    );
    setMessage(
      changed
        ? ''
        : `${row.rule.category.name} allows up to ${row.rule.maxSelections} extras.`,
    );
  }

  function setExtraQuantity(menuItemId: string, quantity: number) {
    updateItemQuantity(menuItemId, Math.max(Math.round(quantity) || 1, 1));
  }

  function updateBoxCount(value: number) {
    const minimum = config?.minGuestCount ?? 1;
    const maximum = config?.maxGuestCount ?? Number.MAX_SAFE_INTEGER;
    const next = Math.min(
      Math.max(Math.round(value) || minimum, minimum),
      maximum,
    );
    setGuestCount(next);
    setBoxCountInput(String(next));
  }

  async function continueToCart() {
    if (!cartPackage || saving) return;
    if (!session) {
      router.push(`/login?returnTo=${encodeURIComponent('/menu/select')}`);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const cart = await apiRequest<{ id: string }>(
        '/cart',
        {
          method: 'PUT',
          body: JSON.stringify({
            packageVersionId: cartPackage.packageVersionId,
            guestCount,
          }),
        },
        session.accessToken,
      );
      setDbCartId(cart.id, session.user.id);
      await apiRequest(
        '/cart/items',
        {
          method: 'PUT',
          body: JSON.stringify({
            items: selectedItems.map((item) => ({
              categoryId: item.categoryId,
              menuItemId: item.menuItemId,
              replacedMenuItemId: item.replacedMenuItemId,
              role: item.role ?? (item.replacedMenuItemId ? 'SWAP' : 'EXTRA'),
              quantity:
                item.role === 'EXTRA' ? (item.quantity ?? guestCount) : 1,
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

  if (!cartPackage) {
    if (searchParams.get('packageVersionId')) {
      return (
        <main className="page-shell">
          <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
        </main>
      );
    }
    return (
      <main className="page-shell">
        <StatePanel
          icon={ShoppingBag}
          eyebrow="Menu builder"
          title="Choose a package before building a menu"
          description="Packages define the included dishes, swaps, and optional extras."
          actionHref="/packages"
          actionLabel="Browse packages"
          secondaryHref="/menu"
          secondaryLabel="Preview dishes"
        />
      </main>
    );
  }
  if (error) {
    return (
      <main className="page-shell">
        <StatePanel
          tone="danger"
          title="Menu could not load"
          description={error}
          actionHref="/packages"
          actionLabel="Choose another package"
        />
      </main>
    );
  }
  if (!config) {
    return (
      <main className="page-shell">
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      </main>
    );
  }

  const activeCategoryName =
    categories.find((category) => category.id === menuCategory)?.name ??
    'All items';

  return (
    <main className="bg-ivory pb-44 text-charcoal md:pb-20 lg:pb-16">
      <div className="border-b border-border/70 bg-ivory">
        <div className="mx-auto max-w-[1440px] px-3 py-2 sm:px-5 sm:py-3 lg:px-6">
          <MenuStepIndicator
            current={1}
            context={isMealBox ? 'Meal box' : 'Package'}
            packageName={config.packageName}
            guestCount={guestCount}
            isMealBox={isMealBox}
          />
        </div>
      </div>

      <div
        className={cn(
          'mx-auto grid max-w-[1440px] min-w-0 gap-4 px-3 py-4 sm:px-5 lg:items-start lg:px-6',
          filtersExpanded
            ? 'lg:grid-cols-[236px_minmax(620px,1fr)_304px]'
            : 'lg:grid-cols-[64px_minmax(620px,1fr)_304px]',
        )}
      >
        <aside className="hidden lg:block">
          <div className="sticky top-[92px] overflow-hidden rounded-xl border border-border/80 bg-[#fffdf8] shadow-[0_10px_28px_-24px_rgba(75,12,23,.6)]">
            <button
              type="button"
              onClick={() => setFiltersExpanded((value) => !value)}
              className={cn(
                'flex h-12 w-full items-center border-b px-4 text-sm font-extrabold uppercase text-charcoal transition hover:bg-primary/[0.025]',
                filtersExpanded ? 'justify-between' : 'justify-center',
              )}
              aria-expanded={filtersExpanded}
              aria-label={
                filtersExpanded
                  ? 'Collapse menu filters'
                  : 'Expand menu filters'
              }
            >
              {filtersExpanded && <span>Categories</span>}
              {filtersExpanded ? (
                <SlidersHorizontal className="h-4 w-4 text-primary" />
              ) : (
                <SlidersHorizontal className="h-4 w-4" />
              )}
            </button>
            {filtersExpanded ? (
              <div className="p-3.5">
                <FilterContents
                  search={menuSearch}
                  setSearch={setMenuSearch}
                  diet={menuDiet}
                  setDiet={setMenuDiet}
                  category={menuCategory}
                  setCategory={setMenuCategory}
                  categories={categories}
                  total={includedRows.length}
                />
              </div>
            ) : (
              <div className="grid gap-2 p-2">
                <button
                  type="button"
                  onClick={() => setFiltersExpanded(true)}
                  className="relative grid h-10 place-items-center rounded-lg bg-primary text-white shadow-sm"
                  aria-label="Open filters and categories"
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {categories.slice(0, 7).map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => setMenuCategory(category.id)}
                    className={cn(
                      'grid h-10 place-items-center rounded-lg text-xs font-bold transition',
                      menuCategory === category.id
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-muted/70',
                    )}
                    title={category.name}
                    aria-label={`Show ${category.name}`}
                  >
                    {category.name.slice(0, 1).toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="hidden">
            <div className="min-w-0">
              <p className="eyebrow">
                {isMealBox ? 'Your meal box' : 'Your package menu'}
              </p>
              <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold leading-tight tracking-tight text-charcoal sm:text-4xl">
                {isMealBox ? 'Review your ' : 'Review your '}
                {config.packageName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">
                {isMealBox
                  ? 'Everything shown is included. Swap only where available.'
                  : 'Everything in the included menu is part of the package. Swap where available, or add optional extras.'}
              </p>
            </div>
            <span className="mt-5 inline-flex min-h-11 max-w-full items-center rounded-full border border-accent/35 bg-accent/[0.10] px-4 text-xs font-bold text-gold-text">
              {config.packageName} · {guestCount}{' '}
              {isMealBox ? 'boxes' : 'guests'}
            </span>
          </div>

          <div className="grid gap-3 rounded-[18px] border border-border/80 bg-white p-3 shadow-[0_12px_32px_-28px_rgba(75,12,23,.65)] sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-4 sm:p-4">
            <div className="h-32 overflow-hidden rounded-xl border border-border/80 bg-muted sm:h-32">
              <img
                src={isMealBox ? '/order-mealbox.png' : '/pkg-puja.png'}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-start gap-2 sm:items-center sm:gap-3">
                <h1 className="min-w-0 flex-1 font-serif text-[25px] font-semibold leading-[1.08] tracking-tight text-charcoal sm:text-[34px]">
                  {config.packageName}
                </h1>
                <div className="numeric-text inline-flex h-10 shrink-0 items-center overflow-hidden rounded-lg border border-border bg-white">
                  <button
                    type="button"
                    aria-label={`Decrease ${isMealBox ? 'meal-box' : 'guest'} count`}
                    disabled={guestCount <= (config.minGuestCount ?? 1)}
                    onClick={() => updateBoxCount(guestCount - 1)}
                    className="grid h-10 w-10 place-items-center text-primary disabled:text-muted-foreground/40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    aria-label={isMealBox ? 'Meal-box count' : 'Guest count'}
                    inputMode="numeric"
                    value={boxCountInput}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '');
                      setBoxCountInput(digits);
                    }}
                    onBlur={() => updateBoxCount(Number(boxCountInput))}
                    className="h-10 w-14 border-x text-center text-sm font-bold outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`Increase ${isMealBox ? 'meal-box' : 'guest'} count`}
                    disabled={Boolean(
                      config.maxGuestCount &&
                      guestCount >= config.maxGuestCount,
                    )}
                    onClick={() => updateBoxCount(guestCount + 1)}
                    className="grid h-10 w-10 place-items-center text-primary disabled:text-muted-foreground/40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="px-3 text-xs font-semibold text-muted-foreground">
                    {isMealBox ? 'boxes' : 'guests'}
                  </span>
                </div>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">
                {isMealBox
                  ? 'Review the dishes included in your meal box and customise available swaps.'
                  : 'A complete traditional spread for your special occasion.'}
              </p>
            </div>
          </div>

          <div
            className="mt-4 grid min-h-11 grid-cols-2 overflow-hidden rounded-lg border border-border/80 bg-white"
            role="tablist"
            aria-label="Menu sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!extrasExpanded}
              className={cn(
                'border-b-2 px-2 py-2 text-xs font-bold leading-tight transition sm:px-4 sm:text-sm',
                !extrasExpanded
                  ? 'border-primary bg-white text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-muted/30 hover:text-primary',
              )}
              onClick={() => setExtrasExpanded(false)}
            >
              <span className="sm:hidden">
                Included ({includedRows.length})
              </span>
              <span className="hidden sm:inline">
                Included in package ({includedRows.length})
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={extrasExpanded}
              disabled={isMealBox || extraRows.length === 0}
              className={cn(
                'border-b-2 px-2 py-2 text-xs font-bold leading-tight transition disabled:cursor-not-allowed disabled:opacity-45 sm:px-4 sm:text-sm',
                extrasExpanded
                  ? 'border-primary bg-white text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-muted/30 hover:text-primary',
              )}
              onClick={() => setExtrasExpanded(true)}
            >
              <span className="sm:hidden">Extras</span>
              <span className="hidden sm:inline">Extras (add more)</span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border bg-white p-2 shadow-sm lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 text-sm font-bold text-primary"
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
              <span className="truncate">Filters & categories</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <span className="hidden max-w-[38%] truncate text-xs font-semibold text-muted-foreground sm:block">
              {activeCategoryName}
            </span>
          </div>

          {!extrasExpanded && (
            <MenuSections
              rows={visibleIncluded}
              supportsSwaps={supportsSwaps}
              currentSwaps={currentSwaps}
              itemById={itemById}
              alternativesFor={alternativesFor}
              openSwap={openSwap}
              openDetails={setDetailItem}
            />
          )}

          {extrasExpanded && !isMealBox && extraRows.length > 0 && (
            <section className="mt-4 rounded-xl border border-border/80 bg-white/70 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Optional extras</p>
                  <h2 className="mt-1 font-serif text-xl font-semibold text-charcoal">
                    Add something more
                  </h2>
                </div>
                <span className="text-xs font-bold text-primary">
                  {selectedExtras.length} added
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedExtras.length
                  ? `${selectedExtras.length} ${selectedExtras.length === 1 ? 'extra' : 'extras'} selected`
                  : 'Your included menu is complete without extras.'}
              </p>
              <div className="mt-4 grid gap-3">
                {visibleExtras.map((row) => (
                  <ExtraRow
                    key={`${row.rule.id}-${row.item.id}`}
                    row={row}
                    selected={selectedIds.has(row.item.id)}
                    quantity={
                      selectedItemById.get(row.item.id)?.quantity ?? guestCount
                    }
                    onToggle={() => toggleExtra(row)}
                    onQuantityChange={(quantity) =>
                      setExtraQuantity(row.item.id, quantity)
                    }
                    onDetails={() =>
                      setDetailItem({
                        item: row.item,
                        categoryName: row.rule.category.name,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {((!extrasExpanded && visibleIncluded.length === 0) ||
            (extrasExpanded && visibleExtras.length === 0)) && (
            <div className="mt-6 rounded-2xl border border-border/80 bg-white p-6 text-center shadow-sm sm:mt-8 sm:p-10">
              <Search className="mx-auto h-6 w-6 text-muted-foreground" />
              <h2 className="mt-3 font-semibold">No matching dishes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another category, diet, or search term.
              </p>
            </div>
          )}

          {isMealBox && (
            <p className="mt-6 rounded-xl border bg-white/70 px-4 py-3 text-xs text-muted-foreground shadow-sm">
              No extras are available for this meal box.
            </p>
          )}
          {message && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            >
              {message}
            </p>
          )}
        </section>

        <aside className="hidden lg:block">
          <MenuSummary
            isMealBox={isMealBox}
            rows={summaryRows}
            extras={selectedExtras}
            selectedItemById={selectedItemById}
            swaps={currentSwaps.size}
            guestCount={guestCount}
            basePerPerson={basePerPerson}
            menuSubtotal={menuSubtotal}
            saving={saving}
            ctaLabel={
              !isMealBox && !extrasExpanded
                ? 'Continue to extras'
                : 'Continue to event & payment'
            }
            onContinue={
              !isMealBox && !extrasExpanded
                ? () => setExtrasExpanded(true)
                : continueToCart
            }
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border/80 bg-white/95 px-3 py-2 shadow-[0_-14px_28px_-22px_rgba(75,12,23,.55)] backdrop-blur md:bottom-0 lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileSummaryOpen(true)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border/80 bg-ivory px-3 py-2 text-left"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              View summary
            </span>
            <span className="block truncate font-bold text-primary">
              {summaryRows.length} included · {formatCurrency(menuSubtotal)}{' '}
              total
            </span>
          </button>
          <Button
            className="min-h-11 shrink-0 px-4 sm:px-5"
            onClick={
              !isMealBox && !extrasExpanded
                ? () => setExtrasExpanded(true)
                : continueToCart
            }
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Continue'}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {mobileFiltersOpen && (
        <MobileSheet
          title="Filters & categories"
          onClose={() => setMobileFiltersOpen(false)}
        >
          <FilterContents
            search={menuSearch}
            setSearch={setMenuSearch}
            diet={menuDiet}
            setDiet={setMenuDiet}
            category={menuCategory}
            setCategory={(category) => {
              setMenuCategory(category);
              setMobileFiltersOpen(false);
            }}
            categories={categories}
            total={includedRows.length}
          />
        </MobileSheet>
      )}

      {mobileSummaryOpen && (
        <MobileSheet
          title={`Your ${isMealBox ? 'meal box' : 'menu'}`}
          onClose={() => setMobileSummaryOpen(false)}
        >
          <MenuSummary
            isMealBox={isMealBox}
            rows={summaryRows}
            extras={selectedExtras}
            selectedItemById={selectedItemById}
            swaps={currentSwaps.size}
            guestCount={guestCount}
            basePerPerson={basePerPerson}
            menuSubtotal={menuSubtotal}
            saving={saving}
            ctaLabel="Continue to event & payment"
            onContinue={continueToCart}
            inline
          />
        </MobileSheet>
      )}

      {activeSwapRow && (
        <SwapDrawer
          row={activeSwapRow}
          alternatives={alternativesFor(activeSwapRow.rule, activeSwapRow.item)}
          pendingSwapId={pendingSwapId}
          setPendingSwapId={setPendingSwapId}
          onCancel={closeSwap}
          onConfirm={() => confirmSwap(activeSwapRow)}
        />
      )}

      {detailItem && (
        <ItemDetails
          detail={detailItem}
          isIncluded={includedRows.some(
            ({ item }) => item.id === detailItem.item.id,
          )}
          selected={selectedIds.has(detailItem.item.id)}
          onToggle={() => {
            const row = extraRows.find(
              ({ item }) => item.id === detailItem.item.id,
            );
            if (row) toggleExtra(row);
            setDetailItem(undefined);
          }}
          onClose={() => setDetailItem(undefined)}
        />
      )}
    </main>
  );
}

function MenuStepIndicator({
  current,
  context,
  packageName,
  guestCount,
  isMealBox,
}: {
  current: 0 | 1 | 2;
  context: 'Package' | 'Meal box';
  packageName: string;
  guestCount: number;
  isMealBox: boolean;
}) {
  const steps = [context, 'Menu', 'Event & payment'];
  const subtitles = [
    `${packageName} • ${guestCount} ${isMealBox ? 'boxes' : 'guests'}`,
    'Review & customise',
    'Confirm & pay',
  ];
  return (
    <nav
      aria-label="Order progress"
      className="rounded-xl border border-border/75 bg-white shadow-[0_8px_24px_-24px_rgba(75,12,23,.55)]"
    >
      <ol className="grid grid-cols-3">
        {steps.map((label, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li key={label} className="relative min-w-0">
              <div
                className={cn(
                  'flex min-h-[58px] min-w-0 items-center justify-center gap-1.5 px-2 text-center text-xs sm:min-h-[66px] sm:justify-start sm:gap-3 sm:px-5 sm:text-sm sm:text-left',
                  active && 'bg-white text-primary',
                  complete && 'text-primary',
                  !active && !complete && 'text-muted-foreground',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-extrabold sm:h-9 sm:w-9 sm:text-sm',
                    complete && 'border-primary bg-primary text-white',
                    active && 'border-accent bg-accent text-accent-foreground',
                    !complete && !active && 'border-border bg-white',
                  )}
                >
                  {complete ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-charcoal">
                    {label}
                  </span>
                  <span className="mt-1 hidden truncate text-xs font-medium text-muted-foreground sm:block">
                    {subtitles[index]}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function FilterContents({
  search,
  setSearch,
  diet,
  setDiet,
  category,
  setCategory,
  categories,
  total,
}: {
  search: string;
  setSearch: (value: string) => void;
  diet: 'all' | 'veg' | 'nonveg';
  setDiet: (value: 'all' | 'veg' | 'nonveg') => void;
  category: string;
  setCategory: (value: string) => void;
  categories: Array<{ id: string; name: string; count: number }>;
  total: number;
}) {
  return (
    <div>
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border/90 bg-white px-3.5 shadow-sm transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search dishes"
          className="min-w-0 flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div className="hidden">
        {(['all', 'veg', 'nonveg'] as const).map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => setDiet(value)}
            className={cn(
              'min-h-11 flex-1 rounded-lg px-2 text-xs font-bold transition',
              diet === value
                ? 'bg-white text-primary shadow-sm ring-1 ring-border/70'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={diet === value}
          >
            {value === 'all' ? 'All' : value === 'veg' ? 'Veg' : 'Non-veg'}
          </button>
        ))}
      </div>
      <nav className="mt-4 space-y-1" aria-label="Menu categories">
        <CategoryButton
          active={category === 'all'}
          label="All items"
          count={total}
          onClick={() => setCategory('all')}
        />
        {categories.map((item) => (
          <CategoryButton
            key={item.id}
            active={category === item.id}
            label={item.name}
            count={item.count}
            onClick={() => setCategory(item.id)}
          />
        ))}
      </nav>
      <div className="mt-5 border-t pt-4">
        <p className="text-xs font-extrabold uppercase text-charcoal">
          Diet preference
        </p>
        <div className="mt-3 flex gap-2">
          {(['all', 'veg', 'nonveg'] as const).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setDiet(value)}
              className={cn(
                'min-h-10 flex-1 rounded-lg border px-2 text-xs font-bold transition',
                diet === value
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-border bg-white text-charcoal hover:border-primary/30',
              )}
              aria-pressed={diet === value}
            >
              {value === 'all' ? 'All' : value === 'veg' ? 'Veg' : 'Non-veg'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setDiet('all');
            setCategory('all');
          }}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-primary/30 bg-white px-4 text-sm font-bold text-primary transition hover:bg-primary/[0.04]"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
}

function CategoryButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-10 w-full items-center justify-between border-l-2 px-3 text-left text-sm transition',
        active
          ? 'border-primary bg-primary/[0.055] font-bold text-primary'
          : 'border-transparent text-muted-foreground hover:bg-white/70 hover:text-foreground',
      )}
      aria-current={active ? 'true' : undefined}
    >
      <span className="truncate">{label}</span>
      <span className="ml-2 text-xs">{count}</span>
    </button>
  );
}

function MenuSections({
  rows,
  supportsSwaps,
  currentSwaps,
  itemById,
  alternativesFor,
  openSwap,
  openDetails,
}: {
  rows: MenuRow[];
  supportsSwaps: boolean;
  currentSwaps: Map<string, SelectedItem>;
  itemById: Map<string, MenuSelectionItem>;
  alternativesFor: (
    rule: CategoryRule,
    item: MenuSelectionItem,
  ) => MenuSelectionItem[];
  openSwap: (row: MenuRow) => void;
  openDetails: (detail: DetailItem) => void;
}) {
  const [swappableOnly, setSwappableOnly] = useState(false);
  const visibleRows = swappableOnly
    ? rows.filter(
        (row) =>
          Boolean(row.item.isSwappable) &&
          alternativesFor(row.rule, row.item).length > 0,
      )
    : rows;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-end">
        <label className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span>Show only swappable</span>
          <button
            type="button"
            onClick={() => setSwappableOnly((value) => !value)}
            className={cn(
              'relative h-6 w-11 rounded-full border transition',
              swappableOnly
                ? 'border-primary bg-primary'
                : 'border-border bg-muted',
            )}
            aria-pressed={swappableOnly}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition',
                swappableOnly ? 'left-5' : 'left-0.5',
              )}
            />
          </button>
        </label>
      </div>
      <section className="overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm">
        <div className="divide-y divide-border/80">
          {visibleRows.map((row) => {
            const alternatives = alternativesFor(row.rule, row.item);
            const currentSwap = currentSwaps.get(row.item.id);
            const shownItem = currentSwap
              ? (itemById.get(currentSwap.menuItemId) ?? row.item)
              : row.item;
            const swappable =
              supportsSwaps &&
              Boolean(row.item.isSwappable) &&
              alternatives.length > 0;
            return (
              <DishRow
                key={row.item.id}
                item={shownItem}
                original={row.item}
                swappable={swappable}
                swapped={Boolean(currentSwap)}
                onSwap={() => openSwap(row)}
                onDetails={() =>
                  openDetails({
                    item: shownItem,
                    categoryName: row.rule.category.name,
                  })
                }
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DishRow({
  item,
  original,
  swappable,
  swapped,
  onSwap,
  onDetails,
}: {
  item: MenuSelectionItem;
  original: MenuSelectionItem;
  swappable: boolean;
  swapped: boolean;
  onSwap: () => void;
  onDetails: () => void;
}) {
  return (
    <article className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 bg-white px-3 py-3 transition hover:bg-ivory/45 sm:grid-cols-[92px_minmax(0,1fr)_170px] sm:items-center sm:px-4">
      <button
        type="button"
        onClick={onDetails}
        className="h-[68px] overflow-hidden rounded-lg bg-muted sm:h-[84px]"
        aria-label={`View details for ${item.name}`}
      >
        <DataImage
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </button>
      <button
        type="button"
        onClick={onDetails}
        className="min-h-11 min-w-0 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <strong className="min-w-0 break-words font-serif text-[16px] leading-tight text-charcoal sm:text-[17px]">
            {item.name}
          </strong>
          <DietBadge isVeg={item.isVeg} />
        </span>
        {(item.description || swapped) && (
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
            {item.description}
            {swapped && `${item.description ? ' · ' : ''}replaces ${original.name}`}
          </span>
        )}
      </button>
      <div className="col-span-2 sm:col-span-1 sm:justify-self-end">
        <button
          type="button"
          onClick={onSwap}
          disabled={!swappable}
          className={cn(
            'inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition sm:min-w-32',
            swappable
              ? 'border-primary/35 bg-white text-primary hover:bg-primary/[0.04]'
              : 'cursor-not-allowed border-border bg-muted/50 text-muted-foreground/70',
          )}
          aria-label={
            swappable
              ? `${swapped ? 'Change swap for' : 'Swap'} ${original.name}`
              : `${original.name} cannot be swapped`
          }
        >
          {swappable ? (
            <ArrowRightLeft className="h-3.5 w-3.5" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          {swappable ? (swapped ? 'Change swap' : 'Swap item') : 'Locked'}
        </button>
      </div>
    </article>
  );
}

function SwapDrawer({
  row,
  alternatives,
  pendingSwapId,
  setPendingSwapId,
  onCancel,
  onConfirm,
}: {
  row: MenuRow;
  alternatives: MenuSelectionItem[];
  pendingSwapId?: string;
  setPendingSwapId: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const original = row.item;
  const selected =
    alternatives.find((item) => item.id === pendingSwapId) ?? original;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 lg:grid lg:justify-items-end">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onCancel}
        aria-label="Close swap options"
      />
      <section className="relative ml-auto flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-ivory shadow-2xl sm:max-w-[520px]">
        <div className="shrink-0 border-b border-border/80 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-primary">Swap item</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-charcoal">
                Choose replacement
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white"
              aria-label="Close swap options"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-border/80 bg-[#fffdf8] p-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Selected item
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-14 w-16 overflow-hidden rounded-lg bg-muted">
                <DataImage
                  src={selected.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-sm text-charcoal">
                  {selected.name}
                </strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {row.rule.category.name} constraint preserved
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-4 [-webkit-overflow-scrolling:touch]">
          <p className="text-sm font-bold text-charcoal">
            Eligible replacements
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Options are limited to the same category and configured package swap
            rules.
          </p>
          <div className="mt-4 grid gap-2" role="radiogroup">
            <SwapChoice
              item={original}
              label="Keep original"
              active={pendingSwapId === original.id}
              onClick={() => setPendingSwapId(original.id)}
            />
            {alternatives.map((item) => (
              <SwapChoice
                key={item.id}
                item={item}
                active={pendingSwapId === item.id}
                onClick={() => setPendingSwapId(item.id)}
              />
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/80 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            {original.name} <ArrowRight className="mx-1 inline h-3 w-3" />{' '}
            <span className="text-foreground">{selected.name}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm}>
              Confirm swap
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SwapChoice({
  item,
  label,
  active,
  onClick,
}: {
  item: MenuSelectionItem;
  label?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid min-h-11 grid-cols-[64px_minmax(0,1fr)_20px] items-center gap-3 rounded-xl border bg-white p-2 text-left transition hover:border-primary/25',
        active && 'border-primary ring-1 ring-primary/40',
      )}
      role="radio"
      aria-checked={active}
    >
      <span className="h-14 overflow-hidden rounded-lg bg-muted">
        <DataImage
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-sm">{item.name}</strong>
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {label ??
            (Number(item.adjustmentAmount) > 0
              ? `+₹${item.adjustmentAmount} per person`
              : 'No price change')}
        </span>
      </span>
      <span
        className={cn(
          'grid h-4 w-4 place-items-center rounded-full border',
          active && 'border-primary bg-primary text-white',
        )}
      >
        {active && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

function ExtraRow({
  row,
  selected,
  quantity,
  onToggle,
  onQuantityChange,
  onDetails,
}: {
  row: MenuRow;
  selected: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantityChange: (quantity: number) => void;
  onDetails: () => void;
}) {
  const unitPrice = Number(
    row.item.itemPrice || row.item.adjustmentAmount || 0,
  );
  const lineTotal = unitPrice * quantity;
  return (
    <article className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border/80 bg-white p-3 shadow-sm sm:grid-cols-[84px_minmax(0,1fr)_auto_auto_auto] sm:gap-4 sm:p-4">
      <button
        type="button"
        onClick={onDetails}
        className="h-[68px] overflow-hidden rounded-xl bg-muted sm:h-[72px]"
      >
        <DataImage
          src={row.item.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </button>
      <button
        type="button"
        onClick={onDetails}
        className="min-h-11 min-w-0 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <strong className="min-w-0 break-words font-serif text-base leading-tight text-charcoal sm:text-lg">
            {row.item.name}
          </strong>
          <DietBadge isVeg={row.item.isVeg} />
        </span>
        <span className="text-xs text-muted-foreground">
          {row.rule.category.name}
        </span>
      </button>
      <span className="hidden text-right text-xs font-bold text-primary sm:block">
        +₹{row.item.itemPrice}
        <small className="block font-normal text-muted-foreground">
          per portion
        </small>
      </span>
      {selected && (
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-2 py-2 sm:col-span-1 sm:w-40 sm:bg-transparent sm:p-0">
          <span className="text-[11px] font-semibold text-muted-foreground sm:hidden">
            {formatCurrency(lineTotal)}
          </span>
          <div className="ml-auto inline-flex h-9 items-center rounded-lg border bg-white">
            <button
              type="button"
              onClick={() => onQuantityChange(quantity - 1)}
              className="grid h-8 w-8 place-items-center text-primary disabled:text-muted-foreground"
              disabled={quantity <= 1}
              aria-label={`Reduce ${row.item.name} portions`}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              value={quantity}
              onChange={(event) =>
                onQuantityChange(Number(event.currentTarget.value))
              }
              className="h-8 w-10 border-x text-center text-xs font-bold outline-none"
              inputMode="numeric"
              aria-label={`${row.item.name} portions`}
            />
            <button
              type="button"
              onClick={() => onQuantityChange(quantity + 1)}
              className="grid h-8 w-8 place-items-center text-primary disabled:text-muted-foreground"
              aria-label={`Increase ${row.item.name} portions`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-xs font-bold sm:col-span-1',
          selected
            ? 'border-primary bg-primary text-white'
            : 'border-primary/50 text-primary hover:bg-primary/5',
        )}
      >
        {selected ? <Check className="mr-1.5 h-3.5 w-3.5" /> : null}
        {selected ? 'Remove extra' : `Add · ₹${row.item.itemPrice}`}
      </button>
    </article>
  );
}

function MenuSummary({
  isMealBox,
  rows,
  extras,
  selectedItemById,
  swaps,
  guestCount,
  basePerPerson,
  menuSubtotal,
  saving,
  ctaLabel,
  onContinue,
  inline = false,
}: {
  isMealBox: boolean;
  rows: Array<{
    categoryName: string;
    original: MenuSelectionItem;
    shown: MenuSelectionItem;
    swapped: boolean;
  }>;
  extras: MenuRow[];
  selectedItemById: Map<string, SelectedItem>;
  swaps: number;
  guestCount: number;
  basePerPerson: number;
  menuSubtotal: number;
  saving: boolean;
  ctaLabel: string;
  onContinue: () => void;
  inline?: boolean;
}) {
  const extrasTotal = extras.reduce((total, row) => {
    const quantity = selectedItemById.get(row.item.id)?.quantity ?? 1;
    return (
      total +
      Number(row.item.itemPrice || row.item.adjustmentAmount || 0) * quantity
    );
  }, 0);
  return (
    <section
      className={cn(
        'overflow-hidden bg-white',
        !inline &&
          'sticky top-[92px] rounded-[18px] border border-border/80 shadow-[0_14px_34px_-28px_rgba(75,12,23,.65)]',
      )}
    >
      {!inline && (
        <div className="border-b border-border/80 bg-white px-5 py-4">
          <p className="eyebrow text-primary">Your menu</p>
        </div>
      )}
      <div
        className={cn(
          'max-h-[44vh] overflow-y-auto',
          inline ? 'divide-y' : 'divide-y px-4',
        )}
      >
        {rows.map((row) => (
          <div key={row.original.id} className="flex items-center gap-3 py-2.5">
            <span className="h-10 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
              <DataImage
                src={row.shown.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block break-words text-sm leading-snug text-charcoal">
                {row.shown.name}
              </strong>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                {row.categoryName}
                {!row.swapped && ' · Included'}
              </span>
            </span>
            {row.swapped && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                Swapped
              </span>
            )}
          </div>
        ))}
        {extras.map((row) => {
          const quantity = selectedItemById.get(row.item.id)?.quantity ?? 1;
          const lineTotal =
            Number(row.item.itemPrice || row.item.adjustmentAmount || 0) *
            quantity;
          return (
            <div key={row.item.id} className="flex items-center gap-3 py-2.5">
              <span className="h-10 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                <DataImage
                  src={row.item.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs">
                  {row.item.name}
                </strong>
                <span className="text-[10px] text-muted-foreground">
                  Extra · {quantity} portion{quantity === 1 ? '' : 's'}
                </span>
              </span>
              <span className="text-[10px] font-bold text-primary">
                +{formatCurrency(lineTotal)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border/80 bg-[#fffdf8] p-5">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Base package</span>
            <span className="numeric-text text-right font-semibold text-charcoal">
              {formatCurrency(basePerPerson)} per {isMealBox ? 'box' : 'guest'}
            </span>
          </div>
          {extrasTotal > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Additional items</span>
              <span className="numeric-text font-semibold text-charcoal">
                {formatCurrency(extrasTotal)}
              </span>
            </div>
          )}
          {swaps > 0 && (
            <div className="flex items-center justify-between gap-4 text-muted-foreground">
              <span>Menu substitutions</span>
              <span className="numeric-text">{swaps}</span>
            </div>
          )}
          <p className="numeric-text pt-1 text-xs text-muted-foreground">
            For {guestCount}{' '}
            {isMealBox
              ? guestCount === 1
                ? 'box'
                : 'boxes'
              : guestCount === 1
                ? 'guest'
                : 'guests'}
          </p>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            Estimated menu total
          </span>
          <strong className="numeric-text text-2xl font-bold text-charcoal">
            {formatCurrency(menuSubtotal)}
          </strong>
        </div>
        <Button
          className="mt-4 min-h-12 w-full rounded-lg"
          onClick={onContinue}
          disabled={saving}
        >
          {saving ? 'Saving menu...' : ctaLabel}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
        {!inline && (
          <Button
            className="mt-3 min-h-11 w-full rounded-lg"
            variant="outline"
            onClick={onContinue}
            disabled={saving}
          >
            View summary
          </Button>
        )}
      </div>
    </section>
  );
}

function DietBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold',
        isVeg
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-orange-50 text-orange-700',
      )}
    >
      <Leaf className="h-3 w-3" /> {isVeg ? 'Veg' : 'Non-veg'}
    </span>
  );
}

function MobileSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={`Dismiss ${title}`}
      />
      <section className="relative max-h-[86vh] w-full overflow-y-auto rounded-t-3xl bg-ivory p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:p-5">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="min-w-0 truncate font-serif text-2xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full border bg-white"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ItemDetails({
  detail,
  isIncluded,
  selected,
  onToggle,
  onClose,
}: {
  detail: DetailItem;
  isIncluded: boolean;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close dish details"
      />
      <section className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:grid sm:max-h-[90vh] sm:grid-cols-[.9fr_1.1fr] sm:rounded-2xl">
        <div className="min-h-44 bg-muted sm:min-h-56">
          <DataImage
            src={detail.item.imageUrl}
            alt={detail.item.name}
            className="h-full min-h-44 w-full object-cover sm:min-h-56"
          />
        </div>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DietBadge isVeg={detail.item.isVeg} />
              <h2 className="mt-3 font-serif text-2xl font-semibold leading-tight sm:text-3xl">
                {detail.item.name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-primary">
                {detail.categoryName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border"
              aria-label="Close dish details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            {detail.item.description ||
              'Freshly prepared for your Feast Factory menu.'}
          </p>
          <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm">
            <span className="text-muted-foreground">Price</span>
            <strong className="float-right">
              {isIncluded
                ? 'Included'
                : `${formatCurrency(
                    detail.item.itemPrice || detail.item.adjustmentAmount,
                  )} per portion`}
            </strong>
          </div>
          {isIncluded ? (
            <Button className="mt-6 w-full" variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : (
            <Button className="mt-6 w-full" onClick={onToggle}>
              {selected ? 'Remove extra' : 'Add extra'}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
