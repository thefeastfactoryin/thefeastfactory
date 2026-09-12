'use client';

import type { MenuCategory, MenuItem } from '@aranyam/shared-types';
import {
  ChevronDown,
  Coffee,
  Cookie,
  Flame,
  LayoutGrid,
  Leaf,
  Search,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StatePanel } from '../../components/ui/state-panel';
import { usePublicSettings } from '../../components/public-settings-provider';
import { DataImage } from '../../components/data-image';
import { apiRequest } from '../../lib/api';
import { generateWhatsAppLink, whatsappMessages } from '../../lib/generate-whatsapp-link';
import { cn } from '../../lib/utils';

type DietaryFilter = 'all' | 'veg' | 'non-veg';
type SortFilter = 'popular' | 'price-low' | 'price-high' | 'name';

/* ─────────────────────────────────────────────────────────
   Category icon helper
───────────────────────────────────────────────────────── */
function getCatIcon(name: string): React.ElementType {
  const n = name.toLowerCase();
  if (/starter|appetizer|snack/.test(n)) return Flame;
  if (/main|course|curry|rice|biryani/.test(n)) return UtensilsCrossed;
  if (/dessert|sweet/.test(n)) return Cookie;
  if (/beverage|drink|juice|tea|coffee/.test(n)) return Coffee;
  return Utensils;
}

/* ═══════════════════════════════════════════════════════
   CategoryNav  — sticky below header
══════════════════════════════════════════════════════════ */
interface MenuSidebarProps {
  categories: MenuCategory[];
  activeId: string;
  onChange: (id: string) => void;
  categoryCounts: Map<string, number>;
  totalCount: number;
  dietary: DietaryFilter;
  onDietaryChange: (v: DietaryFilter) => void;
  sort: SortFilter;
  onSortChange: (v: SortFilter) => void;
}

function MenuSidebar({
  categories,
  activeId,
  onChange,
  categoryCounts,
  totalCount,
  dietary,
  onDietaryChange,
  sort,
  onSortChange,
}: MenuSidebarProps) {
  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] w-[310px] shrink-0 overflow-y-auto border-r border-border/80 bg-white/95 px-6 py-8 shadow-[8px_0_30px_rgba(88,64,48,0.04)] backdrop-blur lg:block">
      <div className="space-y-7">
        <section>
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-amber-800/75">
            Browse Categories
          </p>
          <nav className="mt-4 space-y-2" aria-label="Browse menu categories">
            <CategoryButton
              active={!activeId}
              icon={LayoutGrid}
              label="All Dishes"
              count={totalCount}
              onClick={() => onChange('')}
            />
            {categories.map((cat) => {
              const Icon = getCatIcon(cat.name);
              return (
                <CategoryButton
                  key={cat.id}
                  active={activeId === cat.id}
                  icon={Icon}
                  label={cat.name}
                  count={categoryCounts.get(cat.id) ?? 0}
                  onClick={() => onChange(cat.id)}
                />
              );
            })}
          </nav>
        </section>

        <section className="border-t border-border pt-6">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-amber-800/75">
            Filters
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                { value: 'all', label: 'All', icon: LayoutGrid },
                { value: 'veg', label: 'Veg', icon: Leaf },
                { value: 'non-veg', label: 'Non-Veg', icon: Flame },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onDietaryChange(value)}
                className={cn(
                  'flex h-11 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition',
                  dietary === value
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-border bg-white text-foreground hover:border-primary/40',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <label className="mt-5 block text-xs font-medium text-muted-foreground" htmlFor="menu-sort">
            Sort by
          </label>
          <div className="relative mt-2">
            <select
              id="menu-sort"
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortFilter)}
              className="h-12 w-full appearance-none rounded-lg border border-border bg-white px-4 pr-10 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            >
              <option value="popular">Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name A-Z</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </section>
      </div>
    </aside>
  );
}

function CategoryButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition',
        active
          ? 'bg-primary text-white shadow-sm'
          : 'text-foreground hover:bg-primary/5 hover:text-primary',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cn(
          'rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold',
          active ? 'bg-white text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   FilterBar  — dietary pills + search, low visual weight
══════════════════════════════════════════════════════════ */
interface FilterBarProps {
  dietary: DietaryFilter;
  onDietaryChange: (v: DietaryFilter) => void;
  searchActive: boolean;
  itemCount: number;
  loading: boolean;
}

function FilterBar({
  dietary,
  onDietaryChange,
  searchActive,
  itemCount,
  loading,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      {/* Dietary */}
      <div className="flex items-center gap-1.5">
        {(
          [
            { value: 'all',     label: 'All dishes' },
            { value: 'veg',     label: 'Veg' },
            { value: 'non-veg', label: 'Non-Veg' },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onDietaryChange(value)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              dietary === value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-white text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
        {!loading && itemCount > 0 && !searchActive && (
          <span className="ml-1 text-xs text-muted-foreground">
            {itemCount} {itemCount === 1 ? 'dish' : 'dishes'}
          </span>
        )}
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MenuCard  — image-forward, catering-specific hierarchy
══════════════════════════════════════════════════════════ */
function MenuCard({ item }: { item: MenuItem }) {
  return (
    <article className="group grid min-h-[132px] grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-white shadow-[0_4px_18px_rgba(0,0,0,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_14px_38px_rgba(0,0,0,0.14)] sm:flex sm:flex-col sm:rounded-2xl">

      {/* Food image — 3:2 aspect (slightly shorter than 4:3, fits more cards) */}
      <div className="relative h-full min-h-[132px] overflow-hidden sm:aspect-[4/2.5] sm:h-auto sm:min-h-0">
        <DataImage
          src={item.imageUrl}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />

        {/* Gradient for badge legibility */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/30 to-transparent" />

        {/* Diet badge — top-right */}
        <span
          className={cn(
            'absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold shadow-sm sm:right-3 sm:top-3 sm:text-[10px]',
            item.isVeg ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white',
          )}
        >
          {item.isVeg ? <Leaf className="h-2.5 w-2.5" /> : <Flame className="h-2.5 w-2.5" />}
          {item.isVeg ? 'Veg' : 'Non-Veg'}
        </span>

        {/* Category — bottom-left over gradient */}
        <div className="absolute bottom-2.5 left-3 hidden items-center gap-1.5 sm:flex">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/75">
            {item.category?.name ?? 'Menu'}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        {/* Dish name — primary hierarchy */}
        <h2 className="font-serif text-base font-bold leading-snug text-foreground sm:text-[1.15rem]">
          {item.name}
        </h2>

        {/* Description — 1 line, secondary */}
        {item.description && (
          <p className="mt-1 hidden line-clamp-1 text-xs leading-5 text-muted-foreground sm:block">
            {item.description}
          </p>
        )}

        {/* Push price + controls to bottom */}
        <div className="flex-1" />

        {/* Price — high visual weight */}
        <div className="mt-2 flex items-baseline gap-0.5 sm:mt-4">
          <span className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            ₹{item.generalPrice}
          </span>
          <span className="ml-1 text-xs font-medium text-muted-foreground">/ portion</span>
        </div>

        <p className="mt-3 hidden text-xs text-muted-foreground sm:block">Available in eligible packages</p>
      </div>
    </article>
  );
}


/* ═══════════════════════════════════════════════════════
   Skeleton
══════════════════════════════════════════════════════════ */
function MenuSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5">
          <div className="aspect-[3/2] animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="flex gap-1.5 pt-0.5">
              <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 flex-1 animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════ */
export default function PublicMenuPage() {
  const settings = usePublicSettings();
  const [categories, setCategories]             = useState<MenuCategory[]>([]);
  const [items, setItems]                       = useState<MenuItem[]>([]);
  const [countItems, setCountItems]             = useState<MenuItem[]>([]);
  const [categoryId, setCategoryId]             = useState('');
  const [dietary, setDietary]                   = useState<DietaryFilter>('all');
  const [sort, setSort]                         = useState<SortFilter>('popular');
  const [search, setSearch]                     = useState('');
  const [debouncedSearch, setDebouncedSearch]   = useState('');
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState('');
  const mobileInitialCategorySet = useRef(false);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sort === 'price-low') return Number(a.generalPrice ?? 0) - Number(b.generalPrice ?? 0);
      if (sort === 'price-high') return Number(b.generalPrice ?? 0) - Number(a.generalPrice ?? 0);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [items, sort]);

  const menuSections = useMemo(() => {
    const configured = categories
      .map((category) => ({
        category,
        items: sortedItems.filter((item) => item.category?.id === category.id),
      }))
      .filter(({ items: categoryItems }) => categoryItems.length > 0);
    if (configured.length || sortedItems.length === 0) return configured;

    const fallback = new Map<
      string,
      { category: MenuCategory; items: MenuItem[] }
    >();
    sortedItems.forEach((item) => {
      if (!item.category) return;
      const current = fallback.get(item.category.id) ?? {
        category: item.category,
        items: [],
      };
      current.items.push(item);
      fallback.set(item.category.id, current);
    });
    return Array.from(fallback.values());
  }, [categories, sortedItems]);

  const categoryCounts = useMemo(() => {
    return countItems.reduce((counts, item) => {
      if (!item.category?.id) return counts;
      counts.set(item.category.id, (counts.get(item.category.id) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
  }, [countItems]);

  useEffect(() => {
    apiRequest<MenuCategory[]>('/menu/categories')
      .then(setCategories)
      .catch((reason) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (
      mobileInitialCategorySet.current ||
      categories.length === 0 ||
      typeof window === 'undefined' ||
      !window.matchMedia('(max-width: 1023px)').matches
    ) {
      return;
    }
    mobileInitialCategorySet.current = true;
    setCategoryId(categories[0].id);
  }, [categories]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (dietary !== 'all') params.set('isVeg', dietary === 'veg' ? 'true' : 'false');
    if (debouncedSearch) params.set('search', debouncedSearch);

    setLoading(true);
    setError('');
    apiRequest<MenuItem[]>(`/menu/items${params.size ? `?${params.toString()}` : ''}`)
      .then(setItems)
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [categoryId, dietary, debouncedSearch]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dietary !== 'all') params.set('isVeg', dietary === 'veg' ? 'true' : 'false');
    if (debouncedSearch) params.set('search', debouncedSearch);

    apiRequest<MenuItem[]>(`/menu/items${params.size ? `?${params.toString()}` : ''}`)
      .then(setCountItems)
      .catch(() => setCountItems([]));
  }, [dietary, debouncedSearch]);

  return (
    <div className="min-h-screen bg-[#fbfaf8]">
      {/* ① Sticky category navigation */}
      <div className="mx-auto flex max-w-[1600px]">
        <MenuSidebar
          categories={categories}
          activeId={categoryId}
          onChange={setCategoryId}
          categoryCounts={categoryCounts}
          totalCount={countItems.length || items.length}
          dietary={dietary}
          onDietaryChange={setDietary}
          sort={sort}
          onSortChange={setSort}
        />

      {/* ② Filters, cart context, and compact food grid */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <div className="mx-auto max-w-6xl">
            <div className="relative mb-5">
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search dishes by name..."
                value={search}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);
                  if (value.trim()) setCategoryId('');
                  else if (categories[0]) setCategoryId(categories[0].id);
                }}
                className="h-12 w-full rounded-xl border border-border bg-white pl-12 pr-4 text-sm font-medium shadow-[0_8px_26px_rgba(88,64,48,0.08)] outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 sm:h-14 sm:rounded-2xl sm:pl-14 sm:pr-64"
              />
              <span className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 text-xs font-medium text-muted-foreground sm:block">
                Example: Chicken 65, Paneer, Biryani
              </span>
            </div>
            <div className="lg:hidden">
              <FilterBar
                dietary={dietary}
                onDietaryChange={setDietary}
                searchActive={Boolean(search)}
                itemCount={items.length}
                loading={loading}
              />
              <div className="mb-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {categories.map((cat) => {
                  const Icon = getCatIcon(cat.name);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold',
                        categoryId === cat.id
                          ? 'bg-primary text-white shadow-sm'
                          : 'border border-border bg-white text-muted-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {!categoryId && (
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-end gap-4">
                  <h1 className="font-serif text-3xl font-bold text-foreground">All Dishes</h1>
                  <span className="mb-1 border-l border-border pl-4 text-sm text-muted-foreground">
                    {items.length} {items.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <StatePanel
                tone="danger"
                title="Menu could not load"
                description={error}
                actionHref="/packages"
                actionLabel="Browse packages"
              />
            )}

            {loading && <MenuSkeleton />}

            {!loading && !error && items.length > 0 && (
              <div className="space-y-8 pb-4 lg:space-y-14 lg:pb-8">
                {menuSections.map(({ category, items: categoryItems }, index) => (
                  <section
                    key={category.id}
                    className={cn(
                      'scroll-mt-36',
                      index > 0 && 'border-t-2 border-primary/10 pt-7 lg:pt-10',
                    )}
                    aria-labelledby={`menu-category-${category.id}`}
                  >
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
                      <div>
                        <h2
                          id={`menu-category-${category.id}`}
                          className="font-serif text-2xl font-bold text-foreground lg:text-[1.7rem]"
                        >
                          {category.name}
                        </h2>
                        <div className="mt-2 h-0.5 w-7 bg-amber-500" />
                      </div>
                      <span className="rounded-full border bg-white px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm">
                        {categoryItems.length}{' '}
                        {categoryItems.length === 1 ? 'dish' : 'dishes'}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
                      {categoryItems.map((item) => (
                        <MenuCard key={item.id} item={item} />
                      ))}
                    </div>
                  </section>
                ))}
                <div className="hidden justify-center border-t border-border pt-8 sm:flex">
                  <a
                    href={generateWhatsAppLink(whatsappMessages.recommendation, settings?.business.supportPhone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-primary/35 px-5 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                  >
                    Confused? Get help on WhatsApp
                  </a>
                </div>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="flex flex-col items-center py-24 text-center">
                <Search className="h-9 w-9 text-muted-foreground/40" />
                <h2 className="mt-3 font-serif text-xl font-bold text-foreground">No dishes found</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different category or clear your search.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
