'use client';

import type {
  CartSummary,
  PackageConfiguration,
  PackageSummary,
} from '@aranyam/shared-types';
import {
  ChefHat,
  ChevronRight,
  Clock3,
  IndianRupee,
  Leaf,
  Minus,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DataImage } from '../../../components/data-image';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { StatePanel } from '../../../components/ui/state-panel';
import {
  VisualBuffetBuilder,
  type VisualBuffetItem,
} from '../../../components/visual-buffet-builder';
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
type MenuSelectionItem = CategoryRule['items'][number];

type DishRow = {
  item: MenuSelectionItem;
  categoryId: string;
  categoryName: string;
  maxSelections: number;
};

type DietFilter = 'all' | 'veg' | 'nonveg';
type MobileBuilderTab = 'dishes' | 'visual' | 'summary';

type BuilderCategory = {
  id: string;
  name: string;
  count: number;
  rows: DishRow[];
};

export type VisualBuilderInitialPackage = {
  packageId: string;
  packageVersionId: string;
  packageName: string;
  packageType: PackageConfiguration['packageType'];
  isCustom: boolean;
  basePricePerPlate: string;
  minGuestCount: number;
  maxGuestCount?: number | null;
};

function itemSelectionKey(item: Pick<MenuSelectionItem, 'id' | 'swapForMenuItemId'>) {
  return item.swapForMenuItemId ? `${item.swapForMenuItemId}:${item.id}` : item.id;
}

function selectedItemKey(item: Pick<SelectedItem, 'menuItemId' | 'replacedMenuItemId'>) {
  return item.replacedMenuItemId
    ? `${item.replacedMenuItemId}:${item.menuItemId}`
    : item.menuItemId;
}

function rowPriceLabel(row: DishRow, isCustom: boolean) {
  if (isCustom) return `${formatCurrency(row.item.itemPrice)} / plate`;
  if (row.item.swapForMenuItemId) {
    return Number(row.item.adjustmentAmount) > 0
      ? `Swap +${formatCurrency(row.item.adjustmentAmount)}`
      : 'Free swap';
  }
  return Number(row.item.adjustmentAmount) > 0
    ? `+${formatCurrency(row.item.adjustmentAmount)} / plate`
    : 'Included';
}

function useBuilderCategories(
  config: PackageConfiguration | undefined,
  search: string,
  diet: DietFilter,
) {
  return useMemo<BuilderCategory[]>(() => {
    if (!config) return [];
    const normalized = search.trim().toLowerCase();

    return config.categoryRules.map((rule) => {
      const rows = rule.items
        .map((item) => ({
          item,
          categoryId: rule.category.id,
          categoryName: rule.category.name,
          maxSelections: rule.maxSelections,
        }))
        .filter((row) => diet === 'all' || row.item.isVeg === (diet === 'veg'))
        .filter(
          (row) =>
            !normalized ||
            row.item.name.toLowerCase().includes(normalized) ||
            row.categoryName.toLowerCase().includes(normalized) ||
            row.item.description?.toLowerCase().includes(normalized),
        );

      return {
        id: rule.category.id,
        name: rule.category.name,
        count: rows.length,
        rows,
      };
    });
  }, [config, diet, search]);
}

function EventSummaryBar({
  packageName,
  eventName,
  eventDate,
  guestCount,
  valid,
  onSave,
  onCheckout,
}: {
  packageName: string;
  eventName?: string;
  eventDate?: string;
  guestCount: number;
  valid: boolean;
  onSave: () => void;
  onCheckout: () => void;
}) {
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Choose at checkout';

  return (
    <div className="border-b border-border/70 bg-white">
      <div className="mx-auto grid min-h-[78px] max-w-[1536px] gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid grid-cols-3 gap-2 text-sm sm:divide-x sm:divide-border/80 lg:max-w-xl">
          <SummaryCell label="Event Type" value={eventName || packageName || 'Custom Menu'} />
          <SummaryCell label="Event Date" value={formattedDate} />
          <SummaryCell label="Guests" value={String(guestCount)} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            variant="outline"
            className="min-h-11 rounded-lg border-primary/25 px-4 text-primary"
            disabled={!valid}
            onClick={onSave}
          >
            Save Package
          </Button>
          <Button
            className="min-h-11 rounded-lg bg-primary px-4 lg:min-w-56"
            disabled={!valid}
            onClick={onCheckout}
          >
            Proceed to Checkout
            <ChevronRight className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0 sm:px-4 first:sm:pl-0">
      <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-sm font-semibold text-charcoal',
          emphasis && 'text-base text-primary',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BuilderFilters({
  categories,
  activeCategory,
  search,
  diet,
  onCategoryChange,
  onSearchChange,
  onDietChange,
  onClear,
}: {
  categories: Array<{ id: string; name: string; count: number }>;
  activeCategory: string;
  search: string;
  diet: DietFilter;
  onCategoryChange: (categoryId: string) => void;
  onSearchChange: (search: string) => void;
  onDietChange: (diet: DietFilter) => void;
  onClear: () => void;
}) {
  const hasFilters = Boolean(activeCategory || search.trim() || diet !== 'all');

  return (
    <div className="bg-white">
      <div className="grid grid-cols-2 border-b border-border/80">
        <button
          type="button"
          className="min-h-11 border-b-2 border-primary text-sm font-bold text-primary"
        >
          Menu
        </button>
        <button
          type="button"
          className="min-h-11 border-b-2 border-transparent text-sm font-semibold text-muted-foreground"
        >
          Packages
        </button>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Search dishes</span>
        <span className="flex h-11 items-center gap-2 rounded-md border border-border/90 bg-white px-3 transition focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search dishes"
            className="h-auto min-w-0 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </span>
      </label>

      <div className="mt-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Categories
        </p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <CategoryChip
            active={!activeCategory}
            label="All"
            count={categories.reduce((total, category) => total + category.count, 0)}
            onClick={() => onCategoryChange('')}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              active={activeCategory === category.id}
              label={category.name}
              count={category.count}
              onClick={() => onCategoryChange(category.id)}
            />
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Diet
        </p>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border/80 bg-white p-1">
          {(['all', 'veg', 'nonveg'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={diet === value}
              onClick={() => onDietChange(value)}
              className={cn(
                'min-h-10 rounded-md px-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                diet === value
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-primary/[0.04] hover:text-primary',
              )}
            >
              {value === 'all' ? 'All' : value === 'veg' ? 'Veg' : 'Non-veg'}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!hasFilters}
        onClick={onClear}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary/25 bg-white px-3 text-sm font-bold text-primary transition hover:bg-primary/[0.04] disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground/60"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        Clear filters
      </button>
    </div>
  );
}

function DishCatalogue({
  categories,
  activeCategory,
  search,
  diet,
  selectedIds,
  isCustom,
  isMealBox,
  onCategoryChange,
  onSearchChange,
  onDietChange,
  onClear,
  onSelect,
}: {
  categories: BuilderCategory[];
  activeCategory: string;
  search: string;
  diet: DietFilter;
  selectedIds: Set<string>;
  isCustom: boolean;
  isMealBox: boolean;
  onCategoryChange: (categoryId: string) => void;
  onSearchChange: (search: string) => void;
  onDietChange: (diet: DietFilter) => void;
  onClear: () => void;
  onSelect: (row: DishRow) => void;
}) {
  const categoryFilters = categories.map((category) => ({
    id: category.id,
    name: category.name,
    count: category.count,
  }));

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-r border-border/80 bg-white">
      <div className="border-b border-border/80 bg-white p-4">
        <BuilderFilters
          categories={categoryFilters}
          activeCategory={activeCategory}
          search={search}
          diet={diet}
          onCategoryChange={onCategoryChange}
          onSearchChange={onSearchChange}
          onDietChange={onDietChange}
          onClear={onClear}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
        <CategoryAccordion
          categories={categories}
          activeCategory={activeCategory}
          selectedIds={selectedIds}
          isCustom={isCustom}
          isMealBox={isMealBox}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}

function CategoryChip({
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-[11px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
        active
          ? 'border-primary bg-primary text-white'
          : 'border-border/80 bg-white text-charcoal hover:border-primary/30 hover:text-primary',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px]',
          active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CategoryAccordion({
  categories,
  activeCategory,
  selectedIds,
  isCustom,
  isMealBox,
  onSelect,
}: {
  categories: BuilderCategory[];
  activeCategory: string;
  selectedIds: Set<string>;
  isCustom: boolean;
  isMealBox: boolean;
  onSelect: (row: DishRow) => void;
}) {
  const visibleCategories = activeCategory
    ? categories.filter((category) => category.id === activeCategory)
    : categories;
  const hasRows = visibleCategories.some((category) => category.rows.length > 0);

  if (!hasRows) {
    return (
      <EmptyPanel
        title="No dishes match your search."
        description="Try another category, diet preference, or search term."
      />
    );
  }

  return (
    <div className="space-y-3">
      {visibleCategories.map((category) => {
        return (
          <section key={category.id}>
            <div>
              {category.rows.length ? (
                <div className="space-y-3">
                  {category.rows.map((row) => (
                    <DishBuilderRow
                      key={`${row.categoryId}-${row.item.id}`}
                      row={row}
                      selected={selectedIds.has(itemSelectionKey(row.item))}
                      isCustom={isCustom}
                      locked={isMealBox && !row.item.swapForMenuItemId}
                      onSelect={() => onSelect(row)}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No dishes available in this category.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DishBuilderRow({
  row,
  selected,
  isCustom,
  locked,
  onSelect,
}: {
  row: DishRow;
  selected: boolean;
  isCustom: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={cn(
        'grid min-h-[96px] grid-cols-[112px_minmax(0,1fr)_58px] items-center gap-3 rounded-md border border-border/80 bg-white p-2 transition',
        selected && 'border-primary/30 bg-primary/[0.025]',
        locked && 'opacity-75',
      )}
      aria-current={selected ? 'true' : undefined}
    >
      <div className="h-[82px] overflow-hidden rounded-md bg-muted">
        <DataImage
          src={row.item.imageUrl}
          alt={row.item.name}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="min-w-0 self-stretch py-1">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold leading-tight text-charcoal">
            {row.item.name}
          </h3>
        </div>
        <div className="mt-1">
          <DietBadge isVeg={row.item.isVeg} />
        </div>
        <p className="mt-3 text-xs font-bold text-charcoal">
          {rowPriceLabel(row, isCustom)}
        </p>
      </div>

      <button
        type="button"
        disabled={locked}
        onClick={onSelect}
        className={cn(
          'inline-flex min-h-10 items-center justify-center rounded-md border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
          selected
            ? 'border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/[0.1]'
            : 'border-primary/70 bg-white text-primary hover:bg-primary hover:text-white',
          locked && 'cursor-not-allowed border-border bg-muted text-muted-foreground',
        )}
        aria-label={selected ? `Remove ${row.item.name}` : `Add ${row.item.name}`}
      >
        {selected ? 'Added' : 'Add'}
      </button>
    </article>
  );
}

function BuffetCanvas({
  items,
  selectedCount,
  vegCount,
  nonVegCount,
  estimate,
  onAdd,
  onRemove,
  onClear,
  onViewSummary,
}: {
  items: VisualBuffetItem[];
  selectedCount: number;
  vegCount: number;
  nonVegCount: number;
  estimate: number;
  onAdd: () => void;
  onRemove: (menuItemId: string, replacedMenuItemId?: string | null) => void;
  onClear: () => void;
  onViewSummary: () => void;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold leading-tight text-charcoal">
            Build Your Own Package
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your favorite dishes and customize a menu that fits your occasion.
          </p>
        </div>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary/20 bg-white px-3 text-xs font-bold text-primary transition hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Clear All
          </button>
        )}
      </div>
      <VisualBuffetBuilder items={items} onAdd={onAdd} onRemove={onRemove} />
      <BuilderStatsBar
        selectedCount={selectedCount}
        vegCount={vegCount}
        nonVegCount={nonVegCount}
        estimate={estimate}
        onViewSummary={onViewSummary}
      />
    </section>
  );
}

function BuilderStatsBar({
  selectedCount,
  vegCount,
  nonVegCount,
  estimate,
  onViewSummary,
}: {
  selectedCount: number;
  vegCount: number;
  nonVegCount: number;
  estimate: number;
  onViewSummary: () => void;
}) {
  return (
    <div className="mt-5 grid gap-3 rounded-lg border border-border/80 bg-[#fffdf8] p-4 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-center sm:divide-x sm:divide-border/80">
      <StatsCell label="Items" value={String(selectedCount)} />
      <StatsCell label="Veg items" value={String(vegCount)} />
      <StatsCell label="Non-veg items" value={String(nonVegCount)} />
      <StatsCell
        label="Estimated cost"
        value={formatCurrency(estimate)}
        note="Excluding taxes"
      />
      <button
        type="button"
        onClick={onViewSummary}
        className="min-h-11 rounded-md border border-primary/50 bg-white px-6 text-sm font-bold text-primary transition hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        View Summary
      </button>
    </div>
  );
}

function StatsCell({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 text-center sm:px-3 first:sm:pl-0">
      <p className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-2xl font-semibold text-charcoal">
        {value}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function PackageSummary({
  selectedItems,
  selectedCount,
  guestCount,
  estimate,
  subtotal,
  charges,
  valid,
  onClear,
  onRemove,
  onAddToCart,
  inSheet = false,
}: {
  selectedItems: SelectedItem[];
  selectedCount: number;
  guestCount: number;
  estimate: number;
  subtotal: number;
  charges: number;
  valid: boolean;
  onClear: () => void;
  onRemove: (item: SelectedItem) => void;
  onAddToCart: () => void;
  inSheet?: boolean;
}) {
  const groupedItems = useMemo(() => {
    const groups = new Map<string, SelectedItem[]>();
    selectedItems.forEach((item) => {
      const current = groups.get(item.categoryName) ?? [];
      groups.set(item.categoryName, [...current, item]);
    });
    return Array.from(groups.entries());
  }, [selectedItems]);

  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-none',
        inSheet
          ? 'max-h-[calc(88vh-76px)]'
          : 'max-h-[calc(100vh-178px)]',
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-5 py-4">
        <div>
          <h2 className="font-serif text-xl font-semibold text-charcoal">
            Your Package
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selectedCount} selected items
          </p>
        </div>
        {selectedItems.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary hover:bg-primary/[0.05]"
          >
            Clear all
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {selectedItems.length ? (
          <div className="space-y-4">
            {groupedItems.map(([categoryName, items]) => (
              <section key={categoryName}>
                <h3 className="sticky top-0 z-10 bg-white py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
                  {categoryName}
                </h3>
                <div className="divide-y divide-border/70 border-b border-border/70">
                  {items.map((item) => (
                    <div
                      key={selectedItemKey(item)}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3"
                    >
                      <span className="min-w-0">
                        <strong className="block truncate text-sm text-charcoal">
                          {item.menuItemName}
                        </strong>
                        <span className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                          <DietBadge isVeg={item.isVeg} />
                          {formatCurrency(item.itemPrice)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="grid h-9 grid-cols-[32px_28px_32px] overflow-hidden rounded-lg border border-primary/25 bg-white">
                          <button
                            type="button"
                            onClick={() => onRemove(item)}
                            className="grid place-items-center text-primary hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                            aria-label={`Decrease ${item.menuItemName}`}
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <span
                            className="grid place-items-center border-x border-primary/15 text-xs font-bold text-charcoal"
                            aria-live="polite"
                          >
                            1
                          </span>
                          <button
                            type="button"
                            disabled
                            className="grid place-items-center text-muted-foreground/35"
                            aria-label={`${item.menuItemName} already selected`}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(item)}
                          className="grid h-9 w-9 place-items-center rounded-lg text-primary hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                          aria-label={`Remove ${item.menuItemName}`}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyPanel
            compact
            title="Start building your package"
            description="Add dishes from the menu to see them here."
          />
        )}
      </div>

      <div className="border-t border-border/80 bg-white p-5">
        <SummaryLine label="Selected items" value={String(selectedCount)} />
        <SummaryLine label="Guests" value={String(guestCount)} />
        <SummaryLine label="Subtotal" value={formatCurrency(subtotal)} />
        <SummaryLine label="Taxes & charges" value={formatCurrency(charges)} />
        <div className="mt-2.5 border-t border-border/80 pt-2.5">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Estimated Total
          </p>
          <p className="mt-0.5 font-serif text-2xl font-semibold text-charcoal">
            {formatCurrency(estimate)}
          </p>
        </div>
        <Button
          className="mt-4 min-h-12 w-full rounded-md"
          disabled={!valid}
          onClick={onAddToCart}
        >
          Add to Cart
          <ShoppingBag className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </div>
    </aside>
  );
}

function MobileBuilderSummary({
  selectedCount,
  estimate,
  valid,
  onSummary,
  onAddToCart,
}: {
  selectedCount: number;
  estimate: number;
  valid: boolean;
  onSummary: () => void;
  onAddToCart: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-18px_40px_-28px_rgba(111,29,45,0.85)] xl:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto] items-center gap-3">
        <button
          type="button"
          onClick={onSummary}
          className="min-h-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {selectedCount} selected · Estimated total
          </span>
          <strong className="mt-0.5 block text-lg text-primary">
            {formatCurrency(estimate)}
          </strong>
        </button>
        <Button className="min-h-11 rounded-lg" disabled={!valid} onClick={onAddToCart}>
          Add to Cart
        </Button>
      </div>
    </div>
  );
}

function MobileBuilderTabs({
  activeTab,
  onChange,
}: {
  activeTab: MobileBuilderTab;
  onChange: (tab: MobileBuilderTab) => void;
}) {
  const tabs: Array<{ id: MobileBuilderTab; label: string }> = [
    { id: 'dishes', label: 'Add Dishes' },
    { id: 'visual', label: 'Visual Package' },
    { id: 'summary', label: 'Summary' },
  ];

  return (
    <div className="sticky top-[62px] z-30 border-b border-border/80 bg-ivory/95 px-4 py-2 backdrop-blur xl:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-3 gap-1 rounded-lg border border-border/80 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-h-11 rounded-md px-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-primary/[0.04] hover:text-primary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-charcoal">{value}</strong>
    </div>
  );
}

function DietBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold',
        isVeg ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700',
      )}
    >
      <Leaf className="h-3 w-3" aria-hidden />
      {isVeg ? 'Veg' : 'Non-veg'}
    </span>
  );
}

function EmptyPanel({
  title,
  description,
  compact,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border/80 bg-white/70 text-center',
        compact ? 'my-3 px-4 py-8' : 'px-6 py-10',
      )}
    >
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary/[0.07] text-primary">
        <Utensils className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 font-semibold text-charcoal">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function TrustStrip() {
  const items = [
    {
      icon: ChefHat,
      title: 'Fully Customizable',
      body: 'Choose any dishes you love',
    },
    {
      icon: ShieldCheck,
      title: 'Hygienic & Safe',
      body: 'Prepared with premium ingredients',
    },
    {
      icon: Clock3,
      title: 'On-time Delivery',
      body: 'Punctual delivery for every event',
    },
    {
      icon: IndianRupee,
      title: 'Transparent Pricing',
      body: 'No hidden charges, 100% transparent',
    },
  ];

  return (
    <div className="mx-auto max-w-[1504px] bg-white px-4 pb-5 sm:px-6 xl:px-8">
      <div className="grid gap-0 overflow-hidden rounded-lg border border-border/80 bg-[#fffdf8] sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="grid min-h-20 grid-cols-[56px_minmax(0,1fr)] items-center gap-3 border-border/80 p-4 sm:border-r last:border-r-0"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/[0.07] text-primary">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm text-charcoal">{title}</strong>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {body}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingBuilder() {
  return (
    <main className="bg-ivory pb-10 text-charcoal">
      <div className="border-b border-border/70 bg-[#fffdf8]">
        <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6">
          <div className="h-14 animate-pulse rounded-lg bg-white/80" />
        </div>
      </div>
      <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-5 sm:px-6 xl:grid-cols-[240px_minmax(0,1fr)_304px]">
        <div className="hidden h-72 animate-pulse rounded-xl bg-white/80 xl:block" />
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-xl bg-white/80" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl bg-white/80"
            />
          ))}
        </div>
        <div className="hidden h-96 animate-pulse rounded-xl bg-white/80 xl:block" />
      </div>
    </main>
  );
}

export function VisualBuilderClient({
  initialPackage,
  initialConfig,
}: {
  initialPackage?: VisualBuilderInitialPackage;
  initialConfig?: PackageConfiguration;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSessionStore((state) => state.session);
  const cartPackage = useOrderBuilderStore((state) => state.package);
  const event = useOrderBuilderStore((state) => state.event);
  const guestCount = useOrderBuilderStore((state) => state.guestCount);
  const selectedItems = useOrderBuilderStore((state) => state.selectedItems);
  const setPackage = useOrderBuilderStore((state) => state.setPackage);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const toggleItem = useOrderBuilderStore((state) => state.toggleItem);
  const toggleSwap = useOrderBuilderStore((state) => state.toggleSwap);
  const removeItem = useOrderBuilderStore((state) => state.removeItem);
  const removeSwap = useOrderBuilderStore((state) => state.removeSwap);
  const clearSelections = useOrderBuilderStore((state) => state.clearSelections);

  const effectivePackage = cartPackage ?? initialPackage;
  const [config, setConfig] = useState<PackageConfiguration | undefined>(
    initialConfig,
  );
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [diet, setDiet] = useState<DietFilter>('all');
  const [limitMessage, setLimitMessage] = useState('');
  const [activeMobileTab, setActiveMobileTab] =
    useState<MobileBuilderTab>('visual');
  const [bootstrappingPackage, setBootstrappingPackage] = useState(false);
  const [initialPackageApplied, setInitialPackageApplied] = useState(false);

  useEffect(() => {
    if (!initialPackage || cartPackage || initialPackageApplied) return;
    setPackage(initialPackage);
    setInitialPackageApplied(true);
  }, [cartPackage, initialPackage, initialPackageApplied, setPackage]);

  useEffect(() => {
    const requestedVersionId = searchParams.get('packageVersionId');
    if (effectivePackage?.packageVersionId === requestedVersionId) return;
    if (!requestedVersionId) return;

    setBootstrappingPackage(true);
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
        setError('');
      })
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setBootstrappingPackage(false));
  }, [effectivePackage?.packageVersionId, searchParams, setPackage]);

  useEffect(() => {
    if (effectivePackage || searchParams.get('packageVersionId')) return;

    setBootstrappingPackage(true);
    apiRequest<PackageSummary[]>('/packages')
      .then((packages) => {
        const customPackage = packages.find(
          (item) => item.type === 'CUSTOM_PACKAGE' && item.activeVersion,
        );
        if (!customPackage?.activeVersion) return;
        setPackage({
          packageId: customPackage.id,
          packageVersionId: customPackage.activeVersion.id,
          packageName: customPackage.name,
          packageType: customPackage.type,
          isCustom: customPackage.isCustom,
          basePricePerPlate: customPackage.activeVersion.basePricePerPlate,
          minGuestCount: customPackage.activeVersion.minGuestCount,
          maxGuestCount: customPackage.activeVersion.maxGuestCount,
        });
        setError('');
      })
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setBootstrappingPackage(false));
  }, [effectivePackage, searchParams, setPackage]);

  useEffect(() => {
    if (!effectivePackage?.packageVersionId) return;
    if (initialConfig?.id === effectivePackage.packageVersionId) {
      setConfig(initialConfig);
      return;
    }
    apiRequest<PackageConfiguration>(
      `/package-versions/${effectivePackage.packageVersionId}/configuration`,
    )
      .then((configuration) => {
        setConfig(configuration);
        setError('');
      })
      .catch((reason) => setError((reason as Error).message));
  }, [effectivePackage?.packageVersionId, initialConfig]);

  const categories = useBuilderCategories(config, search, diet);
  const selectedIds = useMemo(
    () => new Set(selectedItems.map(selectedItemKey)),
    [selectedItems],
  );

  const selectedItemImages = useMemo(() => {
    const entries =
      config?.categoryRules.flatMap((rule) =>
        rule.items.map((item) => [item.id, item.imageUrl ?? undefined] as const),
      ) ?? [];
    return new Map(entries);
  }, [config]);
  const buffetItems = useMemo<VisualBuffetItem[]>(
    () =>
      selectedItems.map((item) => ({
        menuItemId: item.menuItemId,
        menuItemName: item.menuItemName,
        categoryName: item.categoryName,
        isVeg: item.isVeg,
        imageUrl: selectedItemImages.get(item.menuItemId),
        replacedMenuItemId: item.replacedMenuItemId,
        canRemove: true,
      })),
    [selectedItemImages, selectedItems],
  );
  const vegCount = selectedItems.filter((item) => item.isVeg).length;
  const nonVegCount = selectedItems.length - vegCount;

  const ruleProgress = useMemo(() => {
    if (!config) return [];
    return config.categoryRules.map((rule) => {
      const count = selectedItems.filter(
        (item) => item.categoryId === rule.category.id,
      ).length;
      return {
        rule,
        count,
        valid: count >= rule.minSelections && count <= rule.maxSelections,
      };
    });
  }, [config, selectedItems]);

  const isMealBox = config?.packageType === 'MEAL_BOX';
  const isCustom = Boolean(config?.isCustom || effectivePackage?.isCustom);
  const valid = isCustom
    ? selectedItems.length > 0
    : isMealBox
      ? true
      : ruleProgress.length > 0 && ruleProgress.every((item) => item.valid);
  const preview = usePackagePreviewQuote({
    packageVersionId: effectivePackage?.packageVersionId,
    guestCount,
    selectedItems,
    enabled: !isCustom || selectedItems.length > 0,
  });
  const perPlate = Number(
    preview.quote?.finalPerPlatePrice ?? effectivePackage?.basePricePerPlate ?? 0,
  );
  const estimate = Number(preview.quote?.totalAmount ?? perPlate * guestCount);
  const subtotal = Number(preview.quote?.subtotalAmount ?? estimate);
  const charges = Math.max(estimate - subtotal, 0);
  function resetFilters() {
    setActiveCategory('');
    setSearch('');
    setDiet('all');
  }

  function removeSelected(item: SelectedItem) {
    if (item.replacedMenuItemId) removeSwap(item.replacedMenuItemId);
    else removeItem(item.menuItemId);
  }

  function removeVisualItem(
    menuItemId: string,
    replacedMenuItemId?: string | null,
  ) {
    if (replacedMenuItemId) removeSwap(replacedMenuItemId);
    else removeItem(menuItemId);
  }

  function selectRow(row: DishRow) {
    if (isMealBox && row.item.swapForMenuItemId) {
      toggleSwap({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        menuItemId: row.item.id,
        menuItemName: row.item.name,
        replacedMenuItemId: row.item.swapForMenuItemId,
        replacedMenuItemName: row.item.swapForMenuItemName,
        role: 'SWAP',
        itemPrice: row.item.itemPrice,
        includedValue: row.item.includedValue,
        adjustmentAmount: row.item.adjustmentAmount,
        isVeg: row.item.isVeg,
      });
      setLimitMessage('');
      return;
    }
    if (isMealBox) {
      setLimitMessage('Choose a replacement option below a swappable item.');
      return;
    }
    const changed = toggleItem(
      {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        menuItemId: row.item.id,
        menuItemName: row.item.name,
        role: isCustom ? 'CUSTOM' : 'EXTRA',
        itemPrice: row.item.itemPrice,
        includedValue: row.item.includedValue,
        adjustmentAmount: row.item.adjustmentAmount,
        isVeg: row.item.isVeg,
      },
      row.maxSelections,
    );
    setLimitMessage(
      changed
        ? ''
        : `${row.categoryName} allows up to ${row.maxSelections} selections.`,
    );
  }

  async function review() {
    if (!session) {
      router.push(
        `/login?returnTo=${encodeURIComponent('/menu/visual-builder')}`,
      );
      return;
    }
    try {
      if (!effectivePackage) return;
      const cart = await apiRequest<CartSummary>(
        '/cart',
        {
          method: 'PUT',
          body: JSON.stringify({
            packageVersionId: effectivePackage.packageVersionId,
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
              role:
                item.role ??
                (item.replacedMenuItemId
                  ? 'SWAP'
                  : effectivePackage?.packageType === 'FIXED_PACKAGE'
                    ? 'EXTRA'
                    : 'CUSTOM'),
              quantity: 1,
            })),
          }),
        },
        session.accessToken,
      );
      router.push('/cart');
    } catch (reason) {
      setLimitMessage((reason as Error).message);
    }
  }

  if (bootstrappingPackage && !effectivePackage) {
    return <LoadingBuilder />;
  }

  if (!effectivePackage) {
    return (
      <main className="page-shell">
        <StatePanel
          icon={ShoppingBag}
          eyebrow="Visual menu builder"
          title="Choose a package before building a visual menu"
          description="Packages define your course rules, included dishes, and premium additions so your estimate stays accurate."
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
          title="Visual builder could not load"
          description={error}
          actionHref="/menu/select"
          actionLabel="Use standard menu builder"
        />
      </main>
    );
  }

  if (!config) {
    return <LoadingBuilder />;
  }

  return (
    <main className="bg-ivory pb-28 text-charcoal xl:pb-10">
      <EventSummaryBar
        packageName={config.packageName || 'Custom Menu'}
        eventName={event?.eventName}
        eventDate={event?.eventDate}
        guestCount={guestCount}
        valid={valid}
        onSave={review}
        onCheckout={review}
      />

      <MobileBuilderTabs
        activeTab={activeMobileTab}
        onChange={setActiveMobileTab}
      />

      {limitMessage && (
        <div className="mx-auto mt-4 max-w-[1560px] px-4 sm:px-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {limitMessage}
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1504px] min-w-0 overflow-hidden border-y border-border/80 bg-white shadow-[0_20px_70px_-55px_rgba(75,12,23,.45)] xl:grid-cols-[344px_minmax(620px,1fr)_326px] xl:items-start">
        <div
          className={cn(
            'min-h-0 xl:sticky xl:top-[78px] xl:block xl:h-[calc(100vh-78px)]',
            activeMobileTab === 'dishes' ? 'block' : 'hidden',
          )}
        >
          <DishCatalogue
            categories={categories}
            activeCategory={activeCategory}
            search={search}
            diet={diet}
            selectedIds={selectedIds}
            isCustom={isCustom}
            isMealBox={Boolean(isMealBox)}
            onCategoryChange={setActiveCategory}
            onSearchChange={setSearch}
            onDietChange={setDiet}
            onClear={resetFilters}
            onSelect={selectRow}
          />
        </div>

        <div
          className={cn(
            'min-w-0 p-4 md:p-8 xl:block',
            activeMobileTab === 'visual' ? 'block' : 'hidden',
          )}
        >
          <BuffetCanvas
            items={buffetItems}
            selectedCount={selectedItems.length}
            vegCount={vegCount}
            nonVegCount={nonVegCount}
            estimate={estimate}
            onAdd={() => setActiveMobileTab('dishes')}
            onRemove={removeVisualItem}
            onClear={clearSelections}
            onViewSummary={() => setActiveMobileTab('summary')}
          />
        </div>

        <div
          className={cn(
            'border-l border-border/80 p-4 xl:sticky xl:top-[78px] xl:block',
            activeMobileTab === 'summary' ? 'block' : 'hidden',
          )}
        >
          <PackageSummary
            selectedItems={selectedItems}
            selectedCount={selectedItems.length}
            guestCount={guestCount}
            estimate={estimate}
            subtotal={subtotal}
            charges={charges}
            valid={valid}
            onClear={clearSelections}
            onRemove={removeSelected}
            onAddToCart={review}
          />
        </div>
      </div>

      <TrustStrip />

      <MobileBuilderSummary
        selectedCount={selectedItems.length}
        estimate={estimate}
        valid={valid}
        onSummary={() => setActiveMobileTab('summary')}
        onAddToCart={review}
      />
    </main>
  );
}
