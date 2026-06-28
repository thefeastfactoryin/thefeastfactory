'use client';

import type { PackageConfiguration } from '@aranyam/shared-types';
import {
  Check,
  ChevronRight,
  ImagePlus,
  Leaf,
  RotateCcw,
  ShoppingBag,
  Utensils,
  X,
  LockKeyhole,
  ArrowRightLeft,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { OrderProgress } from '../../../components/order-progress';
import { SelectionContextPanel } from '../../../components/selection-context-panel';
import { Button } from '../../../components/ui/button';
import { StatePanel } from '../../../components/ui/state-panel';
import { apiRequest } from '../../../lib/api';
import { saveCartBeforeReview } from '../../../lib/cart-review';
import { useOrderBuilderStore } from '../../../store/order-builder.store';
import { useSessionStore } from '../../../store/session.store';

type MenuSelectionItem =
  PackageConfiguration['categoryRules'][number]['items'][number] & {
    ingredients?: string | null;
  };

export default function MenuSelectPage() {
  const router = useRouter();
  const cartPackage = useOrderBuilderStore((state) => state.package);
  const event = useOrderBuilderStore((state) => state.event);
  const guestCount = useOrderBuilderStore((state) => state.guestCount);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const toggleSwap = useOrderBuilderStore((state) => state.toggleSwap);
  const removeSwap = useOrderBuilderStore((state) => state.removeSwap);
  const session = useSessionStore((state) => state.session);
  const selectedItems = useOrderBuilderStore((state) => state.selectedItems);
  const toggleItem = useOrderBuilderStore((state) => state.toggleItem);
  const clearSelections = useOrderBuilderStore(
    (state) => state.clearSelections,
  );
  const [config, setConfig] = useState<PackageConfiguration>();
  const [error, setError] = useState('');
  const [limitMessage, setLimitMessage] = useState('');
  const [detailItem, setDetailItem] = useState<{
    item: MenuSelectionItem;
    categoryId: string;
    categoryName: string;
    maxSelections: number;
  }>();
  const [showAllSwapOptions, setShowAllSwapOptions] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('all');
  const [menuDiet, setMenuDiet] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [swapTarget, setSwapTarget] = useState<{
    included: MenuSelectionItem;
    alternatives: MenuSelectionItem[];
    categoryId: string;
    categoryName: string;
    maxSelections: number;
  }>();

  useEffect(() => {
    if (!cartPackage?.packageVersionId) return;
    apiRequest<PackageConfiguration>(
      `/package-versions/${cartPackage.packageVersionId}/configuration`,
    )
      .then(setConfig)
      .catch((reason) => setError(reason.message));
  }, [cartPackage?.packageVersionId]);

  const ruleProgress = useMemo(() => {
    if (!config) return [];
    return config.categoryRules.map((rule) => {
      const includedCount = rule.items.filter(
        (item) => item.role === 'INCLUDED' && !item.swapForMenuItemId,
      ).length;
      const count =
        config.packageType === 'MEAL_BOX'
          ? includedCount ||
            selectedItems.filter(
              (item) =>
                item.categoryId === rule.category.id && item.role === 'EXTRA',
            ).length
          : selectedItems.filter((item) => item.categoryId === rule.category.id)
              .length;
      return {
        rule,
        count,
        valid: count >= rule.minSelections && count <= rule.maxSelections,
      };
    });
  }, [config, selectedItems]);

  const isCustom = Boolean(config?.isCustom || cartPackage?.isCustom);
  const isMealBox = config?.packageType === 'MEAL_BOX';
  const valid = isMealBox || config?.packageType === 'FIXED_PACKAGE';
  const additions = selectedItems.reduce(
    (total, item) => total + Number(item.adjustmentAmount),
    0,
  );
  const perPlate = Number(cartPackage?.basePricePerPlate ?? 0) + additions;
  const orderedSwapOptions = useMemo(() => {
    if (!swapTarget) return [];
    return [...swapTarget.alternatives].sort((left, right) => {
      const leftDelta = Number(left.adjustmentAmount);
      const rightDelta = Number(right.adjustmentAmount);
      if (leftDelta !== rightDelta) return leftDelta - rightDelta;
      return left.name.localeCompare(right.name);
    });
  }, [swapTarget]);
  const visibleSwapOptions = showAllSwapOptions
    ? orderedSwapOptions
    : orderedSwapOptions.slice(0, 4);
  const unifiedMenuRows = useMemo(() => {
    if (!config) return [];
    return config.categoryRules.flatMap((rule) =>
      rule.items
        .filter(
          (item) =>
            config.packageType !== 'MEAL_BOX' ||
            (item.role === 'INCLUDED' && !item.swapForMenuItemId),
        )
        .map((item) => ({ rule, item })),
    );
  }, [config]);
  const filteredMenuRows = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();
    return unifiedMenuRows.filter(
      ({ rule, item }) =>
        (menuCategory === 'all' || rule.category.id === menuCategory) &&
        (menuDiet === 'all' || item.isVeg === (menuDiet === 'veg')) &&
        (!query ||
          `${item.name} ${item.description ?? ''} ${rule.category.name}`
            .toLowerCase()
            .includes(query)),
    );
  }, [unifiedMenuRows, menuCategory, menuDiet, menuSearch]);
  const selectedItemIds = useMemo(
    () => new Set(selectedItems.map((item) => item.menuItemId)),
    [selectedItems],
  );
  const includedOrSelectedRows = useMemo(
    () =>
      filteredMenuRows.filter(
        ({ item }) => item.role === 'INCLUDED' || selectedItemIds.has(item.id),
      ),
    [filteredMenuRows, selectedItemIds],
  );
  const extraMenuRows = useMemo(
    () =>
      isMealBox
        ? []
        : filteredMenuRows.filter(
            ({ item }) =>
              item.role !== 'INCLUDED' && !selectedItemIds.has(item.id),
          ),
    [filteredMenuRows, isMealBox, selectedItemIds],
  );
  const displayedMenuRows = useMemo(
    () => [...includedOrSelectedRows, ...extraMenuRows],
    [extraMenuRows, includedOrSelectedRows],
  );
  const filterCategories = useMemo(() => {
    const seen = new Set<string>();
    return unifiedMenuRows.flatMap(({ rule }) => {
      if (seen.has(rule.category.id)) return [];
      seen.add(rule.category.id);
      return [rule.category];
    });
  }, [unifiedMenuRows]);
  const showLegacyCategorySections = false;

  function selectItem(
    item: MenuSelectionItem,
    categoryId: string,
    categoryName: string,
    maxSelections: number,
  ) {
    if (isMealBox && item.swapForMenuItemId) {
      return toggleSwap({
        categoryId,
        categoryName,
        menuItemId: item.id,
        menuItemName: item.name,
        replacedMenuItemId: item.swapForMenuItemId,
        replacedMenuItemName: item.swapForMenuItemName,
        role: 'SWAP',
        itemPrice: item.itemPrice,
        adjustmentAmount: item.adjustmentAmount,
        isVeg: item.isVeg,
      });
    }
    const changed = toggleItem(
      {
        categoryId,
        categoryName,
        menuItemId: item.id,
        menuItemName: item.name,
        itemPrice: item.itemPrice,
        adjustmentAmount: item.adjustmentAmount,
        role: item.role === 'EXTRA' ? 'EXTRA' : undefined,
        isVeg: item.isVeg,
      },
      maxSelections,
    );
    setLimitMessage(
      changed
        ? ''
        : `${categoryName} allows up to ${maxSelections} selections.`,
    );
    return changed;
  }

  function detailText(item: MenuSelectionItem) {
    return {
      description:
        item.description ||
        'A Feast Factory catering favourite prepared fresh for your event menu.',
      ingredients:
        item.ingredients ||
        item.description ||
        'Ingredient details will be confirmed by the Aranyam team. Please mention allergies or dietary restrictions in event notes.',
    };
  }

  if (!cartPackage) {
    return (
      <main className="page-shell">
        <StatePanel
          icon={ShoppingBag}
          eyebrow="Menu builder"
          title="Choose a package before building a menu"
          description="Packages define your course rules, included dishes, and premium additions so your estimate stays accurate."
          actionHref="/packages"
          actionLabel="Browse packages"
          secondaryHref="/menu"
          secondaryLabel="Preview dishes"
        />
      </main>
    );
  }

  if (error)
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
  if (!config)
    return (
      <main className="page-shell">
        <div className="h-96 animate-pulse rounded-[2rem] bg-white/60" />
      </main>
    );

  return (
    <main className="page-shell pb-36">
      <OrderProgress current={2} />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Curate your courses</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold sm:text-5xl">
            {config.packageName.toLowerCase().endsWith('menu')
              ? `Build your ${config.packageName}.`
              : `Build your ${config.packageName} menu.`}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {isMealBox
              ? 'Your included menu is already selected. Fixed items stay locked; use Swap on eligible items to compare same-category alternatives and any added price.'
              : isCustom
                ? 'Choose any dishes you like. Item prices update your per-plate estimate instantly.'
                : 'Select within each course limit. Premium dishes update your estimate instantly.'}
          </p>
        </div>
        {selectedItems.length > 0 && (
          <button
            onClick={clearSelections}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            <RotateCcw className="h-4 w-4" /> Clear menu
          </button>
        )}
      </div>
      <div className="mt-8">
        <SelectionContextPanel
          packageVersionId={config.id}
          minPax={config.minGuestCount}
          maxPax={config.maxGuestCount}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <section className="surface-card p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <label className="flex items-center gap-2 rounded-xl border bg-white px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  placeholder="Search all menu items"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <select
                value={menuCategory}
                onChange={(event) => setMenuCategory(event.target.value)}
                className="h-11 rounded-xl border bg-white px-3 text-sm font-semibold"
              >
                <option value="all">All categories</option>
                {filterCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1 rounded-xl border bg-white p-1">
                {(['all', 'veg', 'nonveg'] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setMenuDiet(value)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${menuDiet === value ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {value === 'all'
                      ? 'All'
                      : value === 'veg'
                        ? 'Veg'
                        : 'Non-Veg'}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {displayedMenuRows.length} of {unifiedMenuRows.length}{' '}
              menu items
            </p>
          </section>

          {displayedMenuRows.length ? (
            <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayedMenuRows.map(({ rule, item }, index) => {
                const locked =
                  config.packageType === 'FIXED_PACKAGE' &&
                  item.role === 'INCLUDED';
                const mealIncluded =
                  isMealBox &&
                  item.role === 'INCLUDED' &&
                  !item.swapForMenuItemId;
                const alternatives = mealIncluded
                  ? rule.items.filter(
                      (candidate) => candidate.swapForMenuItemId === item.id,
                    )
                  : [];
                const currentSwap = mealIncluded
                  ? selectedItems.find(
                      (selectedItem) =>
                        selectedItem.replacedMenuItemId === item.id,
                    )
                  : undefined;
                const shownItem = currentSwap
                  ? (alternatives.find(
                      (candidate) => candidate.id === currentSwap.menuItemId,
                    ) ?? item)
                  : item;
                const selected =
                  mealIncluded ||
                  locked ||
                  selectedItems.some(
                    (selectedItem) => selectedItem.menuItemId === item.id,
                  );
                const details = detailText(shownItem);
                return (
                  <Fragment key={`${rule.id}-${item.id}`}>
                    {index === 0 && includedOrSelectedRows.length > 0 && (
                      <div className="col-span-full rounded-2xl border border-primary/20 bg-primary/[0.06] px-5 py-4">
                        <h2 className="font-serif text-2xl font-bold text-primary">
                          {isMealBox
                            ? `Included items (${includedOrSelectedRows.length})`
                            : 'Included & selected items'}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {isMealBox
                            ? 'Your meal box contains only these items. Use Swap where available to replace an item.'
                            : 'These items are already part of your package or have been added to your menu.'}
                        </p>
                      </div>
                    )}
                    {!isMealBox &&
                      extraMenuRows.length > 0 &&
                      index === includedOrSelectedRows.length && (
                        <div className="col-span-full mt-2 border-t-2 border-primary/20 pt-6">
                          <p className="eyebrow">Optional choices</p>
                          <h2 className="mt-2 font-serif text-3xl font-bold">
                            Add Extra Items
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Browse all other dishes below. Extra charges are
                            shown on each card.
                          </p>
                        </div>
                      )}
                    <article
                      className={`group min-w-0 overflow-hidden rounded-xl border text-left transition ${selected ? 'border-primary bg-primary/[0.045] ring-1 ring-primary' : 'bg-white hover:border-primary/30'}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setDetailItem({
                            item: shownItem,
                            categoryId: rule.category.id,
                            categoryName: rule.category.name,
                            maxSelections: rule.maxSelections,
                          })
                        }
                        className="block w-full text-left"
                      >
                        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-muted/60">
                          {shownItem.imageUrl ? (
                            <img
                              src={shownItem.imageUrl}
                              alt={shownItem.name}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <ImagePlus className="h-9 w-9 text-primary/50" />
                          )}
                          <div className="absolute inset-x-3 top-3 flex flex-wrap justify-between gap-2">
                            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-white/60">
                              {rule.category.name}
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ${shownItem.isVeg ? 'bg-emerald-700' : 'bg-red-700'}`}
                            >
                              {shownItem.isVeg ? 'Veg' : 'Non-Veg'}
                            </span>
                          </div>
                        </div>
                        <div className="p-4">
                          <strong className="block font-serif text-xl">
                            {shownItem.name}
                          </strong>
                          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                            {details.description}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-primary">
                            {locked || mealIncluded
                              ? 'Included in package'
                              : `+₹${shownItem.adjustmentAmount || shownItem.itemPrice} per plate`}
                          </p>
                        </div>
                      </button>
                      <div className="flex min-h-14 items-center justify-between gap-2 border-t bg-white/70 p-3">
                        <button
                          type="button"
                          onClick={() =>
                            setDetailItem({
                              item: shownItem,
                              categoryId: rule.category.id,
                              categoryName: rule.category.name,
                              maxSelections: rule.maxSelections,
                            })
                          }
                          className="text-sm font-semibold text-primary"
                        >
                          Details
                        </button>
                        {mealIncluded ? (
                          item.isSwappable && alternatives.length > 0 ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 px-3"
                              onClick={() =>
                                setSwapTarget({
                                  included: item,
                                  alternatives,
                                  categoryId: rule.category.id,
                                  categoryName: rule.category.name,
                                  maxSelections: rule.maxSelections,
                                })
                              }
                            >
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Swap
                            </Button>
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">
                              Included
                            </span>
                          )
                        ) : locked ? (
                          <span className="text-xs font-bold text-muted-foreground">
                            Included · locked
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant={selected ? 'secondary' : 'outline'}
                            className="h-9 px-4"
                            onClick={() =>
                              selectItem(
                                item,
                                rule.category.id,
                                rule.category.name,
                                rule.maxSelections,
                              )
                            }
                          >
                            {selected && <Check className="mr-2 h-4 w-4" />}
                            {selected ? 'Selected' : 'Add'}
                          </Button>
                        )}
                      </div>
                    </article>
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <div className="surface-card p-10 text-center">
              <Search className="mx-auto h-7 w-7 text-muted-foreground" />
              <h2 className="mt-3 font-semibold">No matching menu items</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Change a filter or search term.
              </p>
            </div>
          )}

          {showLegacyCategorySections &&
            config &&
            ruleProgress.map(({ rule, count, valid: ruleValid }) => {
              const displayItems = rule.items
                .filter(
                  (item) =>
                    !isMealBox ||
                    item.role === 'EXTRA' ||
                    !item.swapForMenuItemId,
                )
                .sort((left, right) => {
                  if (config?.packageType !== 'FIXED_PACKAGE') return 0;
                  return (
                    Number(right.role === 'INCLUDED') -
                    Number(left.role === 'INCLUDED')
                  );
                });
              return (
                <section key={rule.id} className="surface-card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white/70 px-5 py-4 sm:px-6">
                    <div>
                      <h2 className="font-serif text-2xl font-semibold">
                        {rule.category.name}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {config!.packageType === 'FIXED_PACKAGE'
                          ? 'Included dishes are locked; extras are optional'
                          : isMealBox && !rule.isMandatory
                            ? 'This category is not included; add any item as an extra'
                            : isCustom
                              ? 'Choose any dishes'
                              : `Choose ${rule.minSelections}-${rule.maxSelections}`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${ruleValid ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {config!.packageType === 'FIXED_PACKAGE'
                        ? `${count} extras selected`
                        : isCustom
                          ? `${count} selected`
                          : `${count} of ${rule.maxSelections} selected`}
                    </span>
                  </div>
                  <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-6">
                    {displayItems.map((item, index) => {
                      const locked =
                        config!.packageType === 'FIXED_PACKAGE' &&
                        item.role === 'INCLUDED';
                      const mealIncluded =
                        isMealBox &&
                        item.role === 'INCLUDED' &&
                        !item.swapForMenuItemId;
                      const alternatives = isMealBox
                        ? rule.items.filter(
                            (candidate) =>
                              candidate.swapForMenuItemId === item.id,
                          )
                        : [];
                      const currentSwap = mealIncluded
                        ? selectedItems.find(
                            (selectedItem) =>
                              selectedItem.replacedMenuItemId === item.id,
                          )
                        : undefined;
                      const shownItem = currentSwap
                        ? (alternatives.find(
                            (candidate) =>
                              candidate.id === currentSwap.menuItemId,
                          ) ?? item)
                        : item;
                      const selected =
                        mealIncluded ||
                        selectedItems.some(
                          (selectedItem) => selectedItem.menuItemId === item.id,
                        );
                      const details = detailText(shownItem);
                      return (
                        <Fragment key={item.id}>
                          {config!.packageType === 'FIXED_PACKAGE' &&
                            (index === 0 ||
                              displayItems[index - 1]?.role !== item.role) && (
                              <div className="col-span-full flex items-center gap-2 border-b pb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                {item.role === 'INCLUDED' ? (
                                  <LockKeyhole className="h-3.5 w-3.5" />
                                ) : (
                                  <ShoppingBag className="h-3.5 w-3.5" />
                                )}
                                {item.role === 'INCLUDED'
                                  ? 'Included menu · locked'
                                  : 'Add optional extras'}
                              </div>
                            )}
                          <article
                            className={`group overflow-hidden rounded-xl border text-left transition ${selected ? 'border-primary bg-primary/[0.045] ring-1 ring-primary' : 'bg-white/75 hover:border-primary/30 hover:bg-white'}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setDetailItem({
                                  item: shownItem,
                                  categoryId: rule.category.id,
                                  categoryName: rule.category.name,
                                  maxSelections: rule.maxSelections,
                                })
                              }
                              className="block w-full text-left"
                            >
                              <div className="relative aspect-[4/3] bg-muted">
                                {shownItem.imageUrl ? (
                                  <img
                                    src={shownItem.imageUrl}
                                    alt={shownItem.name}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                  />
                                ) : (
                                  <div className="grid h-full place-items-center bg-gradient-to-br from-primary/10 via-accent/10 to-white text-primary">
                                    <ImagePlus className="h-9 w-9" />
                                  </div>
                                )}
                                <span
                                  className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${shownItem.isVeg ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}
                                >
                                  <Leaf className="h-3 w-3" />{' '}
                                  {shownItem.isVeg ? 'Veg' : 'Non-veg'}
                                </span>
                              </div>
                              <div className="p-4">
                                <strong className="block font-serif text-xl">
                                  {shownItem.name}
                                </strong>
                                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                                  {details.description}
                                </p>
                                <p className="mt-3 text-xs font-semibold text-muted-foreground">
                                  {isCustom
                                    ? `₹${shownItem.itemPrice} per plate`
                                    : Number(shownItem.adjustmentAmount) > 0
                                      ? `+₹${shownItem.adjustmentAmount} per plate`
                                      : 'Included in package'}
                                </p>
                              </div>
                            </button>
                            <div className="flex items-center justify-between gap-3 border-t bg-white/65 p-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setDetailItem({
                                    item: shownItem,
                                    categoryId: rule.category.id,
                                    categoryName: rule.category.name,
                                    maxSelections: rule.maxSelections,
                                  })
                                }
                                className="text-sm font-semibold text-primary"
                              >
                                View details
                              </button>
                              {mealIncluded ? (
                                <div className="flex items-center gap-2">
                                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                                    <input
                                      type="checkbox"
                                      checked
                                      disabled
                                      className="h-4 w-4 accent-primary"
                                    />
                                    Included
                                  </label>
                                  {item.isSwappable &&
                                  alternatives.length > 0 ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-9 px-3"
                                      onClick={() =>
                                        setSwapTarget({
                                          included: item,
                                          alternatives,
                                          categoryId: rule.category.id,
                                          categoryName: rule.category.name,
                                          maxSelections: rule.maxSelections,
                                        })
                                      }
                                    >
                                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                                      Swap
                                    </Button>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                      <LockKeyhole className="h-3 w-3" />
                                      Fixed
                                    </span>
                                  )}
                                </div>
                              ) : locked ? (
                                <label className="inline-flex items-center gap-2 px-2 text-sm font-semibold text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked
                                    disabled
                                    className="h-4 w-4 accent-primary"
                                  />
                                  Included · locked
                                </label>
                              ) : (
                                <Button
                                  type="button"
                                  variant={selected ? 'secondary' : 'outline'}
                                  className="h-9 px-4"
                                  onClick={() =>
                                    selectItem(
                                      item,
                                      rule.category.id,
                                      rule.category.name,
                                      rule.maxSelections,
                                    )
                                  }
                                >
                                  {selected ? (
                                    <Check className="mr-2 h-4 w-4" />
                                  ) : null}
                                  {selected ? 'Selected' : 'Add'}
                                </Button>
                              )}
                            </div>
                          </article>
                        </Fragment>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          {limitMessage && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {limitMessage}
            </p>
          )}
        </div>

        <aside className="surface-card h-fit p-6 lg:sticky lg:top-28">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Menu progress</p>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-5 space-y-3">
            {ruleProgress.map(({ rule, count, valid: ruleValid }) => (
              <div
                key={rule.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {rule.category.name}
                </span>
                <span
                  className={
                    isCustom || ruleValid
                      ? 'font-semibold text-primary'
                      : 'font-semibold text-amber-700'
                  }
                >
                  {config!.packageType === 'FIXED_PACKAGE'
                    ? `${count} extras`
                    : isCustom
                      ? `${count} selected`
                      : isMealBox && !rule.isMandatory
                        ? `${count} extras`
                        : `${count}/${rule.minSelections} min`}
                </span>
              </div>
            ))}
          </div>
          <div className="my-5 h-px bg-border" />
          <div className="flex justify-between text-sm">
            <span>
              {isCustom
                ? 'Selected item total per plate'
                : 'Estimated per plate'}
            </span>
            <strong>₹{perPlate.toFixed(2)}</strong>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Final total is verified by the server at checkout.
          </p>
          <Button
            className="mt-6 w-full"
            disabled={!valid}
            onClick={async () => {
              if (!session) {
                setLimitMessage('Sign in before checkout.');
                return;
              }
              try {
                const cart = await saveCartBeforeReview({
                  accessToken: session.accessToken,
                  pkg: cartPackage,
                  event,
                  guestCount,
                });
                setDbCartId(cart.id);
                await apiRequest(
                  '/cart/items',
                  {
                    method: 'PUT',
                    body: JSON.stringify({
                      items: selectedItems.map(
                        ({
                          categoryId,
                          menuItemId,
                          replacedMenuItemId,
                          role,
                        }) => ({
                          categoryId,
                          menuItemId,
                          replacedMenuItemId,
                          role:
                            role ??
                            (config!.packageType === 'FIXED_PACKAGE'
                              ? 'EXTRA'
                              : 'SWAP'),
                        }),
                      ),
                    }),
                  },
                  session.accessToken,
                );
                await apiRequest(
                  '/cart/quote',
                  { method: 'POST' },
                  session.accessToken,
                );
                router.push('/checkout');
              } catch (reason) {
                setLimitMessage((reason as Error).message);
              }
            }}
          >
            Review and pay <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </aside>
      </div>
      {swapTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="swap-title"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close swap options"
            onClick={() => {
              setShowAllSwapOptions(false);
              setSwapTarget(undefined);
            }}
          />
          <section className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="p-5 pb-0 sm:p-7 sm:pb-0">
                <p className="eyebrow">Same-category alternatives</p>
                <h2
                  id="swap-title"
                  className="mt-2 font-serif text-3xl font-semibold"
                >
                  Swap {swapTarget.included.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Only eligible {swapTarget.categoryName.toLowerCase()} items
                  are shown. We sort the closest matches first so the shortest
                  path is easier to scan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAllSwapOptions(false);
                  setSwapTarget(undefined);
                }}
                className="m-5 grid h-10 w-10 shrink-0 place-items-center rounded-full border"
                aria-label="Close swap options"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-y bg-slate-50 px-5 py-3 text-xs text-muted-foreground sm:px-7">
              Showing {visibleSwapOptions.length} of {orderedSwapOptions.length}{' '}
              options
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    removeSwap(swapTarget.included.id);
                    setShowAllSwapOptions(false);
                    setSwapTarget(undefined);
                  }}
                  className={`rounded-2xl border p-4 text-left transition hover:border-primary ${selectedItems.some((item) => item.replacedMenuItemId === swapTarget.included.id) ? 'bg-white' : 'border-primary bg-primary/5 ring-1 ring-primary'}`}
                >
                  <span className="block font-semibold">
                    Keep {swapTarget.included.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Included · no price change
                  </span>
                </button>
                {visibleSwapOptions.map((alternative) => {
                  const active = selectedItems.some(
                    (item) =>
                      item.replacedMenuItemId === swapTarget.included.id &&
                      item.menuItemId === alternative.id,
                  );
                  return (
                    <button
                      type="button"
                      key={alternative.id}
                      onClick={() => {
                        selectItem(
                          alternative,
                          swapTarget.categoryId,
                          swapTarget.categoryName,
                          swapTarget.maxSelections,
                        );
                        setShowAllSwapOptions(false);
                        setSwapTarget(undefined);
                      }}
                      className={`rounded-2xl border p-4 text-left transition hover:border-primary ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-white'}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <strong>{alternative.name}</strong>
                        {active && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </span>
                      <span className="mt-2 block text-sm font-semibold text-primary">
                        {Number(alternative.adjustmentAmount) > 0
                          ? `+₹${alternative.adjustmentAmount} per pax`
                          : 'No price change'}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {alternative.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {orderedSwapOptions.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllSwapOptions((value) => !value)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  {showAllSwapOptions
                    ? 'Show fewer options'
                    : `Show all ${orderedSwapOptions.length} options`}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface-card max-h-[92vh] w-full max-w-3xl overflow-hidden bg-white">
            <div className="grid md:grid-cols-[0.95fr_1.05fr]">
              <div className="relative min-h-72 bg-muted">
                {detailItem.item.imageUrl ? (
                  <img
                    src={detailItem.item.imageUrl}
                    alt={detailItem.item.name}
                    className="h-full max-h-[92vh] min-h-72 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full min-h-72 place-items-center bg-gradient-to-br from-primary/10 via-accent/10 to-white text-primary">
                    <Utensils className="h-12 w-12" />
                  </div>
                )}
              </div>
              <div className="overflow-y-auto p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${detailItem.item.isVeg ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}
                    >
                      <Leaf className="h-3 w-3" />{' '}
                      {detailItem.item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                    </span>
                    <h2 className="mt-4 font-serif text-3xl font-semibold">
                      {detailItem.item.name}
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-primary">
                      {detailItem.categoryName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailItem(undefined)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white text-muted-foreground hover:text-foreground"
                    aria-label="Close item details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-6 space-y-5">
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Description
                    </h3>
                    <p className="mt-2 leading-7 text-muted-foreground">
                      {detailText(detailItem.item).description}
                    </p>
                  </section>
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Ingredients
                    </h3>
                    <p className="mt-2 leading-7 text-muted-foreground">
                      {detailText(detailItem.item).ingredients}
                    </p>
                  </section>
                  <div className="rounded-xl bg-muted/60 p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        {isCustom ? 'Item price' : 'Package adjustment'}
                      </span>
                      <strong>
                        {isCustom
                          ? `₹${detailItem.item.itemPrice} per plate`
                          : Number(detailItem.item.adjustmentAmount) > 0
                            ? `+₹${detailItem.item.adjustmentAmount} per plate`
                            : 'Included'}
                      </strong>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      selectItem(
                        detailItem.item,
                        detailItem.categoryId,
                        detailItem.categoryName,
                        detailItem.maxSelections,
                      );
                      setDetailItem(undefined);
                    }}
                  >
                    {selectedItems.some(
                      (selectedItem) =>
                        selectedItem.menuItemId === detailItem.item.id,
                    )
                      ? 'Remove from menu'
                      : 'Add to menu'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
