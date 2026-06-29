'use client';

import type { MenuCategory, MenuItem } from '@aranyam/shared-types';
import {
  ArrowRight,
  ClipboardList,
  Coffee,
  Cookie,
  Flame,
  LayoutGrid,
  Leaf,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatePanel } from '../../components/ui/state-panel';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { apiRequest } from '../../lib/api';
import { cn } from '../../lib/utils';

type DietaryFilter = 'all' | 'veg' | 'non-veg';

/* ─────────────────────────────────────────────────────────
   Category-specific fallback images
   Ensures every card shows real food photography even when
   the database item has no imageUrl.
───────────────────────────────────────────────────────── */
const CATEGORY_FALLBACKS: Array<[RegExp, string]> = [
  [/starter|appetizer|soup/,                     'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=640&q=80'],
  [/biryani|rice|pulao/,                         'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=640&q=80'],
  [/main|course|curry|masala|gravy|butter/,      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=640&q=80'],
  [/paneer|cottage/,                             'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=640&q=80'],
  [/chicken|mutton|meat|fish|prawn|seafood/,     'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=640&q=80'],
  [/dessert|sweet|kheer|halwa|gulab|ladoo|cake/, 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=640&q=80'],
  [/beverage|drink|juice|lassi|chai|tea|coffee/, 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=640&q=80'],
  [/bread|roti|naan|paratha|puri|chapati/,       'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=640&q=80'],
  [/snack|chaat|pakora|samosa|vada|bajji/,       'https://images.unsplash.com/photo-1567188040759-fb8a254b4d85?auto=format&fit=crop&w=640&q=80'],
];
const DEFAULT_FOOD_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=80';

function resolveImage(item: MenuItem): string {
  if (item.imageUrl) return item.imageUrl;
  const haystack = `${item.name} ${item.category?.name ?? ''}`.toLowerCase();
  for (const [pattern, url] of CATEGORY_FALLBACKS) {
    if (pattern.test(haystack)) return url;
  }
  return DEFAULT_FOOD_IMG;
}

/* ─────────────────────────────────────────────────────────
   Catering-context dish tags
───────────────────────────────────────────────────────── */
const DISH_TAGS = [
  { label: 'Bestseller',         cls: 'bg-amber-500' },
  null,
  { label: "Chef's Pick",        cls: 'bg-emerald-600' },
  null,
  { label: 'Corporate Favorite', cls: 'bg-blue-700' },
  { label: 'Most Ordered',       cls: 'bg-rose-600' },
  { label: 'Party Favorite',     cls: 'bg-violet-700' },
  null,
] as const;

function getTag(index: number) {
  return DISH_TAGS[index % DISH_TAGS.length] ?? null;
}

/* ─────────────────────────────────────────────────────────
   Prep style — inferred from dish name / category
───────────────────────────────────────────────────────── */
const PREP_STYLES: Array<[RegExp, string]> = [
  [/fried|fry|65|pakora|bajji|vada|samosa|puri/, 'Deep Fried'],
  [/grilled|tandoor|kebab|tikka|satay|seekh/,    'Tandoor Grilled'],
  [/curry|masala|gravy|butter|makhani|korma/,    'Slow Cooked'],
  [/biryani|pulao|dum/,                          'Dum Cooked'],
  [/steamed|idli|dhokla|modak|momos/,            'Steamed'],
  [/baked|oven|roast/,                           'Oven Baked'],
  [/tossed|noodle|manchurian|chilli|stir/,       'Wok Tossed'],
  [/soup|rasam|sambar|shorba/,                   'Simmered'],
  [/sweet|halwa|kheer|pudding|barfi|ladoo/,      'Hand Made'],
];

function getPrepStyle(name: string, categoryName?: string | null): string | null {
  const haystack = `${name} ${categoryName ?? ''}`.toLowerCase();
  for (const [pattern, style] of PREP_STYLES) {
    if (pattern.test(haystack)) return style;
  }
  return null;
}

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
    <nav className="sticky top-[62px] z-20 border-b border-border bg-white/97 backdrop-blur-md sm:top-[66px]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto py-2.5" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => onChange('')}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
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
                  'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
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
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      {/* Dietary */}
      <div className="flex flex-wrap items-center gap-1.5">
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
              'min-h-11 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
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
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search dishes…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 w-full rounded-full border border-border bg-white pl-9 pr-4 text-sm placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:w-52"
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MenuCard  — image-forward, catering-specific hierarchy
══════════════════════════════════════════════════════════ */
function MenuCard({ item, index }: { item: MenuItem; index: number }) {
  const [qty, setQty] = useState(1);
  const tag      = getTag(index);
  const src      = resolveImage(item);
  const prepStyle = getPrepStyle(item.name, item.category?.name);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_36px_rgba(0,0,0,0.13)]">

      {/* Food image — 3:2 aspect (slightly shorter than 4:3, fits more cards) */}
      <div className="relative aspect-[3/2] overflow-hidden">
        <img
          src={src}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />

        {/* Gradient for badge legibility */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/30 to-transparent" />

        {/* Popularity / catering tag — top-left */}
        {tag && (
          <span
            className={cn(
              'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-sm',
              tag.cls,
            )}
          >
            {tag.label}
          </span>
        )}

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

        {/* Category + prep style — bottom-left over gradient */}
        <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/75">
            {item.category?.name ?? 'Menu'}
          </span>
          {prepStyle && (
            <>
              <span className="text-white/40">·</span>
              <span className="text-[10px] font-semibold text-white/75">{prepStyle}</span>
            </>
          )}
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

        {/* Catering context chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Serves 20–25 Guests
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Min 20 Portions
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Bulk Pricing
          </span>
        </div>

        {/* Push price + controls to bottom */}
        <div className="flex-1" />

        {/* Price — high visual weight */}
        <div className="mt-4 flex items-baseline gap-0.5">
          <span className="text-2xl font-extrabold tracking-tight text-foreground">
            ₹{item.basePrice}
          </span>
          <span className="ml-1 text-xs font-medium text-muted-foreground">/ portion</span>
        </div>

        {/* Quantity + Add — always visible */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-background">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid h-11 w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-bold tabular-nums">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="grid h-11 w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <Link
            href="/packages"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-[0.97]"
          >
            Add to Menu
          </Link>
        </div>
      </div>
    </article>
  );
}

/* "How it works" steps — shown when no order is active */
const HOW_IT_WORKS = [
  { icon: Package,       label: 'Select Package' },
  { icon: UtensilsCrossed, label: 'Add Dishes'  },
  { icon: ClipboardList, label: 'Review Menu'   },
  { icon: ShoppingBag,   label: 'Checkout'      },
] as const;

/* ═══════════════════════════════════════════════════════
   OrderSidebar  — right-hand sticky panel
══════════════════════════════════════════════════════════ */
function OrderSidebar() {
  const [mounted, setMounted] = useState(false);
  const selectedItems = useOrderBuilderStore((s) => s.selectedItems);
  const guestCount    = useOrderBuilderStore((s) => s.guestCount);
  const pkg           = useOrderBuilderStore((s) => s.package);

  useEffect(() => setMounted(true), []);

  const items    = mounted ? selectedItems : [];
  const guests   = mounted ? guestCount   : 0;
  const hasOrder = mounted && Boolean(pkg);
  const total    = hasOrder ? parseFloat(pkg!.basePricePerPlate) * guests : 0;

  /* Per-category selection breakdown for progress widget */
  const catCounts = items.reduce<Record<string, { name: string; count: number }>>((acc, it) => {
    if (!acc[it.categoryId]) acc[it.categoryId] = { name: it.categoryName, count: 0 };
    acc[it.categoryId].count++;
    return acc;
  }, {});
  const catEntries = Object.values(catCounts);
  /* Target = 8 dishes; gives a meaningful progress arc for a typical package */
  const TARGET     = 8;
  const progressPct = Math.min(100, Math.round((items.length / TARGET) * 100));

  return (
    <aside className="sticky top-[7.5rem] overflow-hidden rounded-2xl border border-border bg-white shadow-md">

      {/* ── Header ── */}
      <div className="border-b border-border bg-primary/5 px-5 py-4">
        <h2 className="font-serif text-lg font-bold text-foreground">Your Order</h2>
        {hasOrder
          ? <p className="mt-0.5 truncate text-xs font-medium text-primary">{pkg!.packageName}</p>
          : <p className="mt-0.5 text-xs text-muted-foreground">No active order</p>
        }
      </div>

      {items.length > 0 ? (
        <>
          {/* ── Package progress by category ── */}
          <div className="border-b border-border px-5 py-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Menu Progress
            </p>

            {catEntries.map(({ name, count }) => (
              <div key={name} className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-foreground">{name}</span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {count} {count === 1 ? 'dish' : 'dishes'}
                </span>
              </div>
            ))}

            {/* Progress bar */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {items.length} of {TARGET} dishes
                </span>
                <span className="text-[10px] font-bold text-primary">{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Selected dishes ── */}
          <div className="divide-y divide-border/60">
            {items.slice(0, 6).map((item) => (
              <div key={item.menuItemId} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    item.isVeg ? 'bg-emerald-500' : 'bg-orange-500',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.menuItemName}</p>
                  <p className="text-[11px] text-muted-foreground">{item.categoryName}</p>
                </div>
              </div>
            ))}
            {items.length > 6 && (
              <p className="px-5 py-2 text-xs text-muted-foreground">
                +{items.length - 6} more dishes
              </p>
            )}
          </div>

          {/* ── Order stats ── */}
          <div className="border-t border-border divide-y divide-border/60">
            <div className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="text-muted-foreground">Guests</span>
              <span className="font-bold text-foreground">{guests.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="text-muted-foreground">Selected Dishes</span>
              <span className="font-bold text-foreground">{items.length}</span>
            </div>
          </div>

          {/* ── Estimated total ── */}
          {total > 0 && (
            <div className="border-t border-border bg-primary/5 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Estimated Total
              </p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">
                ₹{total.toLocaleString('en-IN')}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ₹{pkg!.basePricePerPlate}/person × {guests} guests
              </p>
            </div>
          )}
        </>
      ) : (
        /* ── How it works — empty state ── */
        <div className="px-5 py-6">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <ol className="space-y-3">
            {HOW_IT_WORKS.map(({ icon: Icon, label }, i) => (
              <li key={label} className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                  {i + 1}
                </span>
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Start by choosing a catering package. Then browse dishes and build your perfect menu.
          </p>
        </div>
      )}

      {/* ── CTA ── */}
      <div className="border-t border-border px-5 py-4">
        {items.length > 0 ? (
          <Link
            href="/cart"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:bg-primary/90"
          >
            View Cart <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href="/packages"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary px-5 py-3 text-sm font-bold text-primary transition-all duration-200 hover:bg-primary hover:text-white"
          >
            Browse Packages <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </aside>
  );
}

function MobileOrderSummary() {
  const [mounted, setMounted] = useState(false);
  const selectedItems = useOrderBuilderStore((s) => s.selectedItems);
  const guestCount = useOrderBuilderStore((s) => s.guestCount);
  const pkg = useOrderBuilderStore((s) => s.package);

  useEffect(() => setMounted(true), []);

  if (!mounted || !pkg) return null;

  const total = parseFloat(pkg.basePricePerPlate) * guestCount;

  return (
    <div className="fixed inset-x-0 bottom-[4.75rem] z-30 px-4 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-white shadow-2xl">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{pkg.packageName}</p>
          <p className="text-xs font-semibold text-white/75">
            {selectedItems.length} dishes - {guestCount} guests{total > 0 ? ` - Rs.${total.toLocaleString('en-IN')}` : ''}
          </p>
        </div>
        <Link
          href="/cart"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-4 text-sm font-extrabold text-primary shadow transition hover:bg-white/90"
        >
          Cart
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Skeleton
══════════════════════════════════════════════════════════ */
function MenuSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
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
  const [categories, setCategories]             = useState<MenuCategory[]>([]);
  const [items, setItems]                       = useState<MenuItem[]>([]);
  const [categoryId, setCategoryId]             = useState('');
  const [dietary, setDietary]                   = useState<DietaryFilter>('all');
  const [search, setSearch]                     = useState('');
  const [debouncedSearch, setDebouncedSearch]   = useState('');
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState('');

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

      {/* ② Content: food grid (left) + order sidebar (right) */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:flex lg:items-start lg:gap-7">

          {/* Left — filter bar + grid */}
          <div className="min-w-0 flex-1 pb-24 lg:pb-12">
            <FilterBar
              dietary={dietary}
              onDietaryChange={setDietary}
              search={search}
              onSearchChange={setSearch}
              itemCount={items.length}
              loading={loading}
            />

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
              <div className="grid gap-5 lg:grid-cols-2">
                {items.map((item, i) => (
                  <MenuCard key={item.id} item={item} index={i} />
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

          {/* Right — sticky order sidebar (desktop only) */}
          <div className="hidden lg:block lg:w-72 xl:w-80 shrink-0 pt-3">
            <OrderSidebar />
          </div>
        </div>
      </div>
      <MobileOrderSummary />
    </>
  );
}
