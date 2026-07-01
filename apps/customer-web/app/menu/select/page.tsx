'use client';

import type { PackageConfiguration } from '@aranyam/shared-types';
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Leaf,
  LockKeyhole,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { OrderProgress } from '../../../components/order-progress';
import { Button } from '../../../components/ui/button';
import { StatePanel } from '../../../components/ui/state-panel';
import { apiRequest } from '../../../lib/api';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const cartPackage = useOrderBuilderStore((state) => state.package);
  const guestCount = useOrderBuilderStore((state) => state.guestCount);
  const selectedItems = useOrderBuilderStore((state) => state.selectedItems);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const toggleItem = useOrderBuilderStore((state) => state.toggleItem);
  const toggleSwap = useOrderBuilderStore((state) => state.toggleSwap);
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
      router.replace('/menu/visual-builder');
    }
  }, [config?.packageType, router]);

  useEffect(() => {
    if (searchParams.get('focus') === 'extras') setExtrasExpanded(true);
  }, [searchParams]);

  const isMealBox = config?.packageType === 'MEAL_BOX';
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

  function matchesFilters({ rule, item }: MenuRow) {
    const query = menuSearch.trim().toLowerCase();
    return (
      (menuCategory === 'all' || rule.category.id === menuCategory) &&
      (menuDiet === 'all' || item.isVeg === (menuDiet === 'veg')) &&
      (!query ||
        `${item.name} ${item.description ?? ''} ${rule.category.name}`
          .toLowerCase()
          .includes(query))
    );
  }

  const visibleIncluded = includedRows.filter(matchesFilters);
  const visibleExtras = extraRows.filter(matchesFilters);
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

  const additions = selectedItems.reduce(
    (total, selected) =>
      total + Number(itemById.get(selected.menuItemId)?.adjustmentAmount ?? 0),
    0,
  );
  const perPerson = Number(cartPackage?.basePricePerPlate ?? 0) + additions;

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

  function confirmSwap(row: MenuRow) {
    if (!pendingSwapId || pendingSwapId === row.item.id) {
      removeSwap(row.item.id);
    } else {
      const current = currentSwaps.get(row.item.id);
      const alternative = alternativesFor(row.rule, row.item).find(
        (item) => item.id === pendingSwapId,
      );
      if (alternative && current?.menuItemId !== alternative.id) {
        toggleSwap({
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
    setExpandedSwapId(undefined);
    setPendingSwapId(undefined);
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
          }),
        },
        session.accessToken,
      );
      setDbCartId(cart.id);
      await apiRequest(
        '/cart/items',
        {
          method: 'PUT',
          body: JSON.stringify({
            items: selectedItems.map((item) => ({
              categoryId: item.categoryId,
              menuItemId: item.menuItemId,
              replacedMenuItemId: item.replacedMenuItemId,
              role: isMealBox ? 'SWAP' : 'EXTRA',
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

  if (!cartPackage) {
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
    <main className="pb-36 lg:pb-16">
      <div className="border-b bg-white/80">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
          <OrderProgress
            current={1}
            context={isMealBox ? 'Meal box' : 'Package'}
          />
        </div>
      </div>

      <div
        className={cn(
          'mx-auto grid max-w-[1440px] min-w-0 lg:items-start',
          filtersExpanded
            ? 'lg:grid-cols-[230px_minmax(0,1fr)_290px]'
            : 'lg:grid-cols-[64px_minmax(0,1fr)_290px]',
        )}
      >
        <aside className="hidden min-h-[calc(100vh-132px)] border-r bg-white/70 lg:block">
          <div className="sticky top-[72px] p-3">
            <button
              type="button"
              onClick={() => setFiltersExpanded((value) => !value)}
              className={cn(
                'flex h-11 w-full items-center rounded-xl border bg-white text-sm font-bold text-primary transition hover:bg-primary/5',
                filtersExpanded ? 'justify-between px-3' : 'justify-center',
              )}
              aria-expanded={filtersExpanded}
              aria-label={
                filtersExpanded
                  ? 'Collapse menu filters'
                  : 'Expand menu filters'
              }
            >
              {filtersExpanded && <span>Filters & categories</span>}
              {filtersExpanded ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <SlidersHorizontal className="h-4 w-4" />
              )}
            </button>
            {filtersExpanded ? (
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
            ) : (
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersExpanded(true)}
                  className="relative grid h-11 place-items-center rounded-xl bg-primary text-white"
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
                      'grid h-10 place-items-center rounded-xl text-xs font-bold',
                      menuCategory === category.id
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-muted',
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

        <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">
                {isMealBox ? 'Your meal box' : 'Your package menu'}
              </p>
              <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                {isMealBox ? 'Review your ' : 'Review your '}
                {config.packageName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {isMealBox
                  ? 'Everything shown is included. Swap only where available.'
                  : 'Everything in the included menu is fixed. Add optional extras if you would like.'}
              </p>
            </div>
            <span className="rounded-lg border border-primary/15 bg-primary/[0.035] px-3 py-2 text-xs font-bold text-primary">
              {config.packageName} · {guestCount}{' '}
              {isMealBox ? 'boxes' : 'guests'}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StateBadge tone="included" label="Included" />
            <StateBadge tone="fixed" label="Fixed" icon={LockKeyhole} />
            {isMealBox ? (
              <StateBadge
                tone="swap"
                label="Swap available"
                icon={ArrowRightLeft}
              />
            ) : (
              <StateBadge tone="extra" label="Optional extra" />
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-y py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold text-primary"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters & categories
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <span className="truncate text-xs font-semibold text-muted-foreground">
              {activeCategoryName}
            </span>
          </div>

          <MenuSections
            rows={visibleIncluded}
            isMealBox={isMealBox}
            currentSwaps={currentSwaps}
            itemById={itemById}
            expandedSwapId={expandedSwapId}
            pendingSwapId={pendingSwapId}
            setPendingSwapId={setPendingSwapId}
            alternativesFor={alternativesFor}
            openSwap={openSwap}
            closeSwap={() => {
              setExpandedSwapId(undefined);
              setPendingSwapId(undefined);
            }}
            confirmSwap={confirmSwap}
            openDetails={setDetailItem}
          />

          {!isMealBox && extraRows.length > 0 && (
            <section className="mt-8 border-t pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Optional extras</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold">
                    Add something more
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setExtrasExpanded((value) => !value)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-bold text-primary hover:bg-primary/5"
                  aria-expanded={extrasExpanded}
                >
                  {extrasExpanded ? 'Hide extras' : `Browse ${extraRows.length} extras`}
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 transition',
                      extrasExpanded && 'rotate-90',
                    )}
                  />
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedExtras.length
                  ? `${selectedExtras.length} extras selected`
                  : 'Your included menu is complete without extras.'}
              </p>
              {extrasExpanded ? (
                <div className="mt-4 divide-y border-y">
                  {visibleExtras.map((row) => (
                    <ExtraRow
                      key={`${row.rule.id}-${row.item.id}`}
                      row={row}
                      selected={selectedIds.has(row.item.id)}
                      onToggle={() => toggleExtra(row)}
                      onDetails={() =>
                        setDetailItem({
                          item: row.item,
                          categoryName: row.rule.category.name,
                        })
                      }
                    />
                  ))}
                </div>
              ) : selectedExtras.length > 0 ? (
                <div className="mt-4 divide-y border-y">
                  {selectedExtras.map((row) => (
                  <ExtraRow
                    key={`${row.rule.id}-${row.item.id}`}
                    row={row}
                    selected
                    onToggle={() => toggleExtra(row)}
                    onDetails={() =>
                      setDetailItem({
                        item: row.item,
                        categoryName: row.rule.category.name,
                      })
                    }
                  />
                  ))}
                </div>
              ) : null}
            </section>
          )}

          {visibleIncluded.length === 0 && visibleExtras.length === 0 && (
            <div className="mt-8 rounded-2xl border bg-white p-10 text-center">
              <Search className="mx-auto h-6 w-6 text-muted-foreground" />
              <h2 className="mt-3 font-semibold">No matching dishes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another category, diet, or search term.
              </p>
            </div>
          )}

          {isMealBox && (
            <p className="mt-6 rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
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

        <aside className="hidden min-h-[calc(100vh-132px)] border-l bg-white/55 p-5 lg:block">
          <MenuSummary
            isMealBox={isMealBox}
            rows={summaryRows}
            extras={selectedExtras}
            swaps={currentSwaps.size}
            guestCount={guestCount}
            perPerson={perPerson}
            saving={saving}
            onContinue={continueToCart}
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t bg-white/95 p-3 shadow-[0_-14px_28px_-22px_rgba(75,12,23,.7)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileSummaryOpen(true)}
            className="min-w-0 text-left"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              View your {isMealBox ? 'meal box' : 'menu'}
            </span>
            <span className="block font-bold text-primary">
              {summaryRows.length} included · ₹{perPerson.toFixed(2)}
            </span>
          </button>
          <Button onClick={continueToCart} disabled={saving}>
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
            swaps={currentSwaps.size}
            guestCount={guestCount}
            perPerson={perPerson}
            saving={saving}
            onContinue={continueToCart}
            inline
          />
        </MobileSheet>
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
    <div className="mt-4">
      <label className="flex h-11 items-center gap-2 rounded-xl border bg-white px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search dishes"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <div className="mt-4 flex gap-1 rounded-xl bg-muted/60 p-1">
        {(['all', 'veg', 'nonveg'] as const).map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => setDiet(value)}
            className={cn(
              'flex-1 rounded-lg px-2 py-2 text-xs font-bold',
              diet === value
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground',
            )}
            aria-pressed={diet === value}
          >
            {value === 'all' ? 'All' : value === 'veg' ? 'Veg' : 'Non-veg'}
          </button>
        ))}
      </div>
      <nav className="mt-5 space-y-1" aria-label="Menu categories">
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
        'flex w-full items-center justify-between rounded-xl border-l-4 px-3 py-3 text-left text-sm transition',
        active
          ? 'border-primary bg-primary/[0.06] font-bold text-primary'
          : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
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
  isMealBox,
  currentSwaps,
  itemById,
  expandedSwapId,
  pendingSwapId,
  setPendingSwapId,
  alternativesFor,
  openSwap,
  closeSwap,
  confirmSwap,
  openDetails,
}: {
  rows: MenuRow[];
  isMealBox: boolean;
  currentSwaps: Map<string, SelectedItem>;
  itemById: Map<string, MenuSelectionItem>;
  expandedSwapId?: string;
  pendingSwapId?: string;
  setPendingSwapId: (id: string) => void;
  alternativesFor: (
    rule: CategoryRule,
    item: MenuSelectionItem,
  ) => MenuSelectionItem[];
  openSwap: (row: MenuRow) => void;
  closeSwap: () => void;
  confirmSwap: (row: MenuRow) => void;
  openDetails: (detail: DetailItem) => void;
}) {
  const grouped = rows.reduce<Array<{ rule: CategoryRule; rows: MenuRow[] }>>(
    (groups, row) => {
      const existing = groups.find((group) => group.rule.id === row.rule.id);
      if (existing) existing.rows.push(row);
      else groups.push({ rule: row.rule, rows: [row] });
      return groups;
    },
    [],
  );

  return (
    <div className="mt-6 space-y-7">
      {grouped.map((group) => (
        <section key={group.rule.id}>
          <div className="flex items-center gap-3 border-b pb-2">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
              {group.rule.category.name}
            </h2>
            <span className="text-xs text-muted-foreground">
              {group.rows.length}
            </span>
          </div>
          <div className="divide-y">
            {group.rows.map((row) => {
              const alternatives = alternativesFor(row.rule, row.item);
              const currentSwap = currentSwaps.get(row.item.id);
              const shownItem = currentSwap
                ? (itemById.get(currentSwap.menuItemId) ?? row.item)
                : row.item;
              const swappable =
                isMealBox &&
                Boolean(row.item.isSwappable) &&
                alternatives.length > 0;
              const expanded = expandedSwapId === row.item.id;
              return (
                <div key={row.item.id}>
                  <DishRow
                    item={shownItem}
                    original={row.item}
                    categoryName={row.rule.category.name}
                    swappable={swappable}
                    swapped={Boolean(currentSwap)}
                    expanded={expanded}
                    onSwap={() => (expanded ? closeSwap() : openSwap(row))}
                    onDetails={() =>
                      openDetails({
                        item: shownItem,
                        categoryName: row.rule.category.name,
                      })
                    }
                  />
                  {expanded && (
                    <InlineSwap
                      original={row.item}
                      alternatives={alternatives}
                      pendingSwapId={pendingSwapId}
                      setPendingSwapId={setPendingSwapId}
                      onCancel={closeSwap}
                      onConfirm={() => confirmSwap(row)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function DishRow({
  item,
  original,
  categoryName,
  swappable,
  swapped,
  expanded,
  onSwap,
  onDetails,
}: {
  item: MenuSelectionItem;
  original: MenuSelectionItem;
  categoryName: string;
  swappable: boolean;
  swapped: boolean;
  expanded: boolean;
  onSwap: () => void;
  onDetails: () => void;
}) {
  return (
    <article className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <button
        type="button"
        onClick={onDetails}
        className="h-[72px] overflow-hidden rounded-lg bg-muted sm:h-[70px]"
        aria-label={`View details for ${item.name}`}
      >
        <img
          src={foodImage(item)}
          alt=""
          className="h-full w-full object-cover"
        />
      </button>
      <button type="button" onClick={onDetails} className="min-w-0 text-left">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="truncate font-serif text-lg leading-tight">
            {item.name}
          </strong>
          <DietBadge isVeg={item.isVeg} />
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {categoryName}
          {swapped && ` · replaces ${original.name}`}
        </span>
      </button>
      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        {swapped ? (
          <StateBadge tone="swap" label="Swapped" icon={ArrowRightLeft} />
        ) : swappable ? (
          <StateBadge tone="included" label="Included" />
        ) : (
          <StateBadge tone="fixed" label="Fixed" icon={LockKeyhole} />
        )}
        {swappable && (
          <button
            type="button"
            onClick={onSwap}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/50 px-3 text-xs font-bold text-primary hover:bg-primary/5"
            aria-expanded={expanded}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {swapped ? 'Change' : 'Swap'}
          </button>
        )}
      </div>
    </article>
  );
}

function InlineSwap({
  original,
  alternatives,
  pendingSwapId,
  setPendingSwapId,
  onCancel,
  onConfirm,
}: {
  original: MenuSelectionItem;
  alternatives: MenuSelectionItem[];
  pendingSwapId?: string;
  setPendingSwapId: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const selected =
    alternatives.find((item) => item.id === pendingSwapId) ?? original;
  return (
    <div className="mb-3 rounded-xl border bg-[#fcfaf6] p-4 sm:ml-[100px]">
      <p className="text-sm font-bold">Choose a replacement</p>
      <div className="mt-3 grid max-h-40 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground">
          {original.name} <ArrowRight className="mx-1 inline h-3 w-3" />{' '}
          <span className="text-foreground">{selected.name}</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Confirm swap
          </Button>
        </div>
      </div>
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
        'grid grid-cols-[64px_minmax(0,1fr)_20px] items-center gap-3 rounded-xl border bg-white p-2 text-left',
        active && 'border-primary ring-1 ring-primary',
      )}
      role="radio"
      aria-checked={active}
    >
      <span className="h-14 overflow-hidden rounded-lg bg-muted">
        <img
          src={foodImage(item)}
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
  onToggle,
  onDetails,
}: {
  row: MenuRow;
  selected: boolean;
  onToggle: () => void;
  onDetails: () => void;
}) {
  return (
    <article className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[84px_minmax(0,1fr)_auto_auto] sm:gap-4">
      <button
        type="button"
        onClick={onDetails}
        className="h-16 overflow-hidden rounded-lg bg-muted"
      >
        <img
          src={foodImage(row.item)}
          alt=""
          className="h-full w-full object-cover"
        />
      </button>
      <button type="button" onClick={onDetails} className="min-w-0 text-left">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="truncate font-serif text-lg">
            {row.item.name}
          </strong>
          <DietBadge isVeg={row.item.isVeg} />
        </span>
        <span className="text-xs text-muted-foreground">
          {row.rule.category.name}
        </span>
      </button>
      <span className="hidden text-right text-xs font-bold sm:block">
        +₹{row.item.adjustmentAmount}
        <small className="block font-normal text-muted-foreground">
          per person
        </small>
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-bold',
          selected
            ? 'border-primary bg-primary text-white'
            : 'border-primary/50 text-primary hover:bg-primary/5',
        )}
      >
        {selected ? <Check className="mr-1.5 h-3.5 w-3.5" /> : null}
        {selected ? 'Selected' : `Add · ₹${row.item.adjustmentAmount}`}
      </button>
    </article>
  );
}

function MenuSummary({
  isMealBox,
  rows,
  extras,
  swaps,
  guestCount,
  perPerson,
  saving,
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
  swaps: number;
  guestCount: number;
  perPerson: number;
  saving: boolean;
  onContinue: () => void;
  inline?: boolean;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden bg-white',
        !inline &&
          'sticky top-24 rounded-2xl border shadow-[0_12px_35px_-28px_rgba(75,12,23,.6)]',
      )}
    >
      {!inline && (
        <div className="border-b px-5 py-4">
          <h2 className="font-serif text-2xl font-semibold text-primary">
            Your {isMealBox ? 'meal box' : 'menu'}
          </h2>
        </div>
      )}
      <div
        className={cn(
          'max-h-[46vh] overflow-y-auto',
          inline ? 'divide-y' : 'divide-y px-5',
        )}
      >
        {rows.map((row) => (
          <div key={row.original.id} className="flex items-center gap-3 py-2.5">
            <span className="h-10 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
              <img
                src={foodImage(row.shown)}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs">
                {row.shown.name}
              </strong>
              <span className="block truncate text-[10px] text-muted-foreground">
                {row.categoryName}
              </span>
            </span>
            <span
              className={cn(
                'text-[10px] font-bold',
                row.swapped ? 'text-emerald-700' : 'text-muted-foreground',
              )}
            >
              {row.swapped ? 'Swapped' : 'Included'}
            </span>
          </div>
        ))}
        {extras.map((row) => (
          <div key={row.item.id} className="flex items-center gap-3 py-2.5">
            <span className="h-10 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
              <img
                src={foodImage(row.item)}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs">
                {row.item.name}
              </strong>
              <span className="text-[10px] text-muted-foreground">Extra</span>
            </span>
            <span className="text-[10px] font-bold text-primary">
              +₹{row.item.adjustmentAmount}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t p-5">
        <div className="grid gap-3 text-sm">
          <SummaryLine label="Included" value={String(rows.length)} />
          {isMealBox && <SummaryLine label="Swaps" value={String(swaps)} />}
          {!isMealBox && (
            <SummaryLine label="Extras" value={String(extras.length)} />
          )}
          <SummaryLine
            label={isMealBox ? 'Boxes' : 'Guests'}
            value={String(guestCount)}
          />
        </div>
        <div className="my-4 h-px bg-border" />
        <div className="flex items-end justify-between gap-3">
          <span className="text-xs text-muted-foreground">Estimated</span>
          <strong className="font-serif text-2xl">
            ₹{perPerson.toFixed(2)}
          </strong>
        </div>
        <p className="mt-1 text-right text-[10px] text-muted-foreground">
          per {isMealBox ? 'box' : 'person'}
        </p>
        <Button className="mt-5 w-full" onClick={onContinue} disabled={saving}>
          {saving ? 'Saving menu…' : 'Continue to event & payment'}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StateBadge({
  tone,
  label,
  icon: Icon,
}: {
  tone: 'included' | 'fixed' | 'swap' | 'extra';
  label: string;
  icon?: typeof Check;
}) {
  const styles = {
    included: 'border-amber-200 bg-amber-50 text-amber-700',
    fixed: 'border-slate-200 bg-slate-50 text-slate-600',
    swap: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    extra: 'border-rose-200 bg-rose-50 text-primary',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold',
        styles[tone],
      )}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}

function DietBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
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
      <section className="relative max-h-[86vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="font-serif text-2xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border"
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close dish details"
      />
      <section className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:grid sm:grid-cols-[.9fr_1.1fr]">
        <div className="min-h-56 bg-muted">
          <img
            src={foodImage(detail.item)}
            alt={detail.item.name}
            className="h-full min-h-56 w-full object-cover"
          />
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DietBadge isVeg={detail.item.isVeg} />
              <h2 className="mt-3 font-serif text-3xl font-semibold">
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
                : `+₹${detail.item.adjustmentAmount} per person`}
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
