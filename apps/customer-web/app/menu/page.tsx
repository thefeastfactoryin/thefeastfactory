'use client';

import type { MenuCategory, MenuItem } from '@aranyam/shared-types';
import {
  ArrowRight,
  Coffee,
  Cookie,
  Flame,
  LayoutGrid,
  Leaf,
  Search,
  ShoppingBag,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatePanel } from '../../components/ui/state-panel';
import { DataImage } from '../../components/data-image';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { useSessionStore } from '../../store/session.store';
import { apiRequest } from '../../lib/api';
import { cn } from '../../lib/utils';

type DietaryFilter = 'all' | 'veg' | 'non-veg';

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
interface CategoryNavProps {
  categories: MenuCategory[];
  activeId: string;
  onChange: (id: string) => void;
}

function CategoryNav({ categories, activeId, onChange }: CategoryNavProps) {
  return (
    <nav className="sticky top-16 z-20 border-b border-border bg-white/97 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto py-2.5" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => onChange('')}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
              !activeId ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            All
          </button>
          {categories.map((cat) => {
            const Icon = getCatIcon(cat.name);
            const active = activeId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onChange(cat.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                  active ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════
   FilterBar  — dietary pills + search, low visual weight
══════════════════════════════════════════════════════════ */
interface FilterBarProps {
  dietary: DietaryFilter;
  onDietaryChange: (v: DietaryFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
  itemCount: number;
  loading: boolean;
}

function FilterBar({ dietary, onDietaryChange, search, onSearchChange, itemCount, loading }: FilterBarProps) {
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
        {!loading && itemCount > 0 && !search && (
          <span className="ml-1 text-xs text-muted-foreground">
            {itemCount} {itemCount === 1 ? 'dish' : 'dishes'}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search dishes…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-44 rounded-full border border-border bg-white pl-9 pr-4 text-sm placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:w-52"
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MenuCard  — image-forward, catering-specific hierarchy
══════════════════════════════════════════════════════════ */
function MenuCard({ item }: { item: MenuItem }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_4px_18px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_14px_38px_rgba(0,0,0,0.14)]">

      {/* Food image — 3:2 aspect (slightly shorter than 4:3, fits more cards) */}
      <div className="relative aspect-[4/2.5] overflow-hidden">
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
            'absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm',
            item.isVeg ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white',
          )}
        >
          {item.isVeg ? <Leaf className="h-2.5 w-2.5" /> : <Flame className="h-2.5 w-2.5" />}
          {item.isVeg ? 'Veg' : 'Non-Veg'}
        </span>

        {/* Category — bottom-left over gradient */}
        <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/75">
            {item.category?.name ?? 'Menu'}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Dish name — primary hierarchy */}
        <h2 className="font-serif text-[1.15rem] font-bold leading-snug text-foreground">
          {item.name}
        </h2>

        {/* Description — 1 line, secondary */}
        {item.description && (
          <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
            {item.description}
          </p>
        )}

        {/* Push price + controls to bottom */}
        <div className="flex-1" />

        {/* Price — high visual weight */}
        <div className="mt-4 flex items-baseline gap-0.5">
          <span className="text-2xl font-extrabold tracking-tight text-foreground">
            ₹{item.generalPrice}
          </span>
          <span className="ml-1 text-xs font-medium text-muted-foreground">/ portion</span>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">Available in eligible packages</p>
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

function CompactCartBanner() {
  const [mounted, setMounted] = useState(false);
  const session = useSessionStore((state) => state.session);
  const pkg = useOrderBuilderStore((state) => state.package);
  const items = useOrderBuilderStore((state) => state.selectedItems);
  useEffect(() => setMounted(true), []);
  const hasCart = mounted && Boolean(session) && Boolean(pkg);
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10"><ShoppingBag className="h-4 w-4 text-primary" /></span><div><p className="text-sm font-bold">{hasCart ? pkg!.packageName : 'Ready to build an order?'}</p><p className="text-xs text-muted-foreground">{hasCart ? `${items.length} menu change${items.length === 1 ? '' : 's'} selected` : 'Choose a package before adding dishes.'}</p></div></div>
    <Link href={hasCart ? '/cart' : '/packages'} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">{hasCart ? 'View cart' : 'Browse packages'}<ArrowRight className="h-3.5 w-3.5" /></Link>
  </div>;
}

/* ═══════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════ */
export default function PublicMenuPage() {
  const [categories, setCategories]             = useState<MenuCategory[]>([]);
  const [items, setItems]                       = useState<MenuItem[]>([]);
  const [categoryId, setCategoryId]             = useState('');
  const [dietary, setDietary]                   = useState<DietaryFilter>('all');
  const [search, setSearch]                     = useState('');
  const [debouncedSearch, setDebouncedSearch]   = useState('');
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState('');

  const menuSections = useMemo(() => {
    const configured = categories
      .map((category) => ({
        category,
        items: items.filter((item) => item.category?.id === category.id),
      }))
      .filter(({ items: categoryItems }) => categoryItems.length > 0);
    if (configured.length || items.length === 0) return configured;

    const fallback = new Map<
      string,
      { category: MenuCategory; items: MenuItem[] }
    >();
    items.forEach((item) => {
      if (!item.category) return;
      const current = fallback.get(item.category.id) ?? {
        category: item.category,
        items: [],
      };
      current.items.push(item);
      fallback.set(item.category.id, current);
    });
    return Array.from(fallback.values());
  }, [categories, items]);

  useEffect(() => {
    apiRequest<MenuCategory[]>('/menu/categories')
      .then(setCategories)
      .catch((reason) => setError(reason.message));
  }, []);

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

  return (
    <>
      {/* ① Sticky category navigation */}
      <CategoryNav categories={categories} activeId={categoryId} onChange={setCategoryId} />

      {/* ② Filters, cart context, and compact food grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="min-w-0 pb-24 lg:pb-12">
            <FilterBar
              dietary={dietary}
              onDietaryChange={setDietary}
              search={search}
              onSearchChange={setSearch}
              itemCount={items.length}
              loading={loading}
            />
            <div className="mb-5"><CompactCartBanner /></div>

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
              <div className="space-y-14 pb-8">
                {menuSections.map(({ category, items: categoryItems }, index) => (
                  <section
                    key={category.id}
                    className={cn(
                      'scroll-mt-36',
                      index > 0 && 'border-t-2 border-primary/10 pt-10',
                    )}
                    aria-labelledby={`menu-category-${category.id}`}
                  >
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="eyebrow">
                          {categoryId ? 'Selected category' : 'Menu category'}
                        </p>
                        <h2
                          id={`menu-category-${category.id}`}
                          className="mt-1 font-serif text-3xl font-bold text-foreground"
                        >
                          {category.name}
                        </h2>
                      </div>
                      <span className="rounded-full border bg-white px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm">
                        {categoryItems.length}{' '}
                        {categoryItems.length === 1 ? 'dish' : 'dishes'}
                      </span>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {categoryItems.map((item) => (
                        <MenuCard key={item.id} item={item} />
                      ))}
                    </div>
                  </section>
                ))}
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

      </div>
    </>
  );
}
