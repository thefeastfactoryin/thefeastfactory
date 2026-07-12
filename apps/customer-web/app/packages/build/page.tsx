'use client';

import type { CartSummary, PackageConfiguration } from '@aranyam/shared-types';
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useOrderBuilderStore } from '../../../store/order-builder.store';
import { useSessionStore } from '../../../store/session.store';

const MIN_GUESTS = 20;
const MAX_GUESTS = 1000;

const DISHES = [
  { id: 'vs1', name: 'Crispy Corn', price: 180, veg: true, cat: 'veg-starters' },
  { id: 'vs2', name: 'Paneer Tikka', price: 220, veg: true, cat: 'veg-starters' },
  { id: 'vs3', name: 'Veg Manchurian', price: 190, veg: true, cat: 'veg-starters' },
  { id: 'vs4', name: 'Hara Bhara Kebab', price: 210, veg: true, cat: 'veg-starters' },
  { id: 'vs5', name: 'Cheesy Corn Balls', price: 200, veg: true, cat: 'veg-starters' },
  { id: 'nv1', name: 'Chicken Tikka', price: 260, veg: false, cat: 'non-veg-starters' },
  { id: 'nv2', name: 'Chilli Chicken', price: 240, veg: false, cat: 'non-veg-starters' },
  { id: 'nv3', name: 'Fish Amritsari', price: 290, veg: false, cat: 'non-veg-starters' },
  { id: 'nv4', name: 'Mutton Seekh Kebab', price: 320, veg: false, cat: 'non-veg-starters' },
  { id: 'mc1', name: 'Paneer Butter Masala', price: 250, veg: true, cat: 'main-course' },
  { id: 'mc2', name: 'Dal Makhani', price: 200, veg: true, cat: 'main-course' },
  { id: 'mc3', name: 'Veg Kofta Curry', price: 230, veg: true, cat: 'main-course' },
  { id: 'mc4', name: 'Chicken Curry', price: 280, veg: false, cat: 'main-course' },
  { id: 'mc5', name: 'Mutton Rogan Josh', price: 340, veg: false, cat: 'main-course' },
  { id: 'rb1', name: 'Jeera Rice', price: 120, veg: true, cat: 'rice-bread' },
  { id: 'rb2', name: 'Veg Biryani', price: 220, veg: true, cat: 'rice-bread' },
  { id: 'rb3', name: 'Steamed Rice', price: 110, veg: true, cat: 'rice-bread' },
  { id: 'rb4', name: 'Butter Naan', price: 40, veg: true, cat: 'rice-bread' },
  { id: 'rb5', name: 'Tandoori Roti', price: 25, veg: true, cat: 'rice-bread' },
  { id: 'ds1', name: 'Gulab Jamun', price: 120, veg: true, cat: 'dessert' },
  { id: 'ds2', name: 'Rasmalai', price: 150, veg: true, cat: 'dessert' },
  { id: 'ds3', name: 'Gajar Halwa', price: 140, veg: true, cat: 'dessert' },
  { id: 'ds4', name: 'Vanilla Ice Cream', price: 100, veg: true, cat: 'dessert' },
  { id: 'bv1', name: 'Fresh Lime Juice', price: 60, veg: true, cat: 'beverage' },
  { id: 'bv2', name: 'Masala Chaas', price: 50, veg: true, cat: 'beverage' },
  { id: 'bv3', name: 'Soft Drinks', price: 40, veg: true, cat: 'beverage' },
  { id: 'bv4', name: 'Mango Lassi', price: 80, veg: true, cat: 'beverage' },
] as const;

type Dish = {
  id: string;
  name: string;
  price: number;
  veg: boolean;
  cat: string;
  categoryId: string;
  categoryName: string;
  itemPrice: string;
  includedValue?: string;
  adjustmentAmount: string;
};
type DishId = string;
type CategoryFilter = 'all' | string;
type DietFilter = 'all' | 'veg' | 'nonveg';
type MobileTab = 'dishes' | 'visual' | 'summary';

const FALLBACK_DISHES: Dish[] = DISHES.map((dish) => ({
  ...dish,
  categoryId: dish.cat,
  categoryName:
    dish.cat === 'veg-starters'
      ? 'Veg Starters'
      : dish.cat === 'non-veg-starters'
        ? 'Non-Veg Starters'
        : dish.cat === 'main-course'
          ? 'Main Course'
          : dish.cat === 'rice-bread'
            ? 'Rice & Bread'
            : dish.cat === 'dessert'
              ? 'Desserts'
              : 'Beverages',
  itemPrice: String(dish.price),
  adjustmentAmount: '0.00',
}));

const CATS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'veg-starters', label: 'Veg Starters' },
  { id: 'non-veg-starters', label: 'Non-Veg Starters' },
  { id: 'main-course', label: 'Main Course' },
  { id: 'rice-bread', label: 'Rice & Bread' },
  { id: 'dessert', label: 'Desserts' },
  { id: 'beverage', label: 'Beverages' },
];

function dishesFromConfig(config: PackageConfiguration): Dish[] {
  return config.categoryRules.flatMap((rule) =>
    rule.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.itemPrice ?? item.adjustmentAmount ?? 0),
      veg: item.isVeg,
      cat: rule.category.id,
      categoryId: rule.category.id,
      categoryName: rule.category.name,
      itemPrice: item.itemPrice,
      includedValue: item.includedValue,
      adjustmentAmount: item.adjustmentAmount,
    })),
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function clampGuestCount(value: number) {
  return Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, value));
}

function roundSlotValue(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function getDishImage(dish: Dish) {
  if (dish.cat === 'rice-bread') return '/tray-3.png';
  if (dish.cat === 'dessert') return '/tray-5.png';
  if (dish.cat === 'beverage') return '/tray-8.png';
  if (dish.cat === 'main-course') return '/pkg-farmhouse.png';
  return '/order-build.png';
}

function VegDot({ veg }: { veg: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border',
        veg ? 'border-emerald-600' : 'border-red-600',
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          veg ? 'bg-emerald-600' : 'bg-red-600',
        )}
      />
    </span>
  );
}

function GuestStepper({
  guestCount,
  guestInput,
  onStep,
  onInputChange,
  onInputBlur,
}: {
  guestCount: number;
  guestInput: string;
  onStep: (delta: number) => void;
  onInputChange: (value: string) => void;
  onInputBlur: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2 shadow-sm">
      <div className="min-w-0">
        <label
          htmlFor="guest-count"
          className="block text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Guests
        </label>
        <p className="mt-0.5 text-[11px] font-semibold leading-4 text-muted-foreground">
          Min {MIN_GUESTS}
        </p>
      </div>
      <div className="flex h-10 shrink-0 items-center overflow-hidden rounded-lg border border-border bg-[#fbf8f2] focus-within:ring-2 focus-within:ring-primary/20">
        <button
          type="button"
          aria-label="Decrease guest count"
          disabled={guestCount <= MIN_GUESTS}
          onClick={() => onStep(-1)}
          className="grid h-10 w-10 shrink-0 place-items-center text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          id="guest-count"
          inputMode="numeric"
          min={MIN_GUESTS}
          max={MAX_GUESTS}
          value={guestInput}
          onBlur={onInputBlur}
          onChange={(event) => onInputChange(event.target.value)}
          className="h-10 w-14 border-x border-border bg-white text-center text-sm font-extrabold text-foreground outline-none"
        />
        <button
          type="button"
          aria-label="Increase guest count"
          disabled={guestCount >= MAX_GUESTS}
          onClick={() => onStep(1)}
          className="grid h-10 w-10 shrink-0 place-items-center text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BanquetTable({
  dishMap,
  order,
}: {
  dishMap: Record<string, Dish>;
  order: DishId[];
}) {
  const slots = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const angle = ((-90 + index * 30) * Math.PI) / 180;
      const x = roundSlotValue(50 + 40 * Math.cos(angle));
      const y = roundSlotValue(50 + 31 * Math.sin(angle));
      const scale = roundSlotValue(
        0.82 + ((Math.sin(angle) + 1) / 2) * 0.42,
        6,
      );
      const z = 10 + Math.round((Math.sin(angle) + 1) * 9);
      return { scale, x, y, z };
    });
  }, []);

  return (
    <div className="relative h-[300px] w-full sm:h-[355px] lg:h-[410px]">
      <div className="absolute left-1/2 top-1/2 z-[5] flex h-[56%] w-[72%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[50%] bg-[radial-gradient(ellipse_at_50%_32%,hsl(33_40%_64%),hsl(30_42%_48%)_58%,hsl(27_44%_35%))] shadow-[0_32px_54px_rgba(0,0,0,0.45),inset_0_-12px_34px_rgba(0,0,0,0.28),inset_0_8px_22px_rgba(255,255,255,0.14)] sm:h-[62%]">
        <div className="select-none text-center">
          <div className="mb-0.5 font-serif text-[10px] font-bold tracking-[0.28em] text-[hsla(28,50%,22%,0.5)] sm:text-[11px]">
            THE
          </div>
          <div className="font-serif text-xl font-bold tracking-normal text-[hsla(28,52%,24%,0.62)] [text-shadow:0_1px_0_hsla(40,60%,82%,0.45)] sm:text-[26px]">
            FEAST FACTORY
          </div>
          <div className="mt-1 text-[8px] font-bold tracking-[0.24em] text-[hsla(28,50%,22%,0.5)] sm:text-[9px]">
            GREAT FOOD
          </div>
        </div>
      </div>

      {slots.map((slot, index) => {
        const id = order[index];
        const dish = id ? dishMap[id] : null;
        return (
          <div
            key={index}
            className="absolute h-[66px] w-[84px] sm:h-[78px] sm:w-[100px]"
            style={{
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              transform: `translate(-50%,-50%) scale(${slot.scale})`,
              transformOrigin: 'center center',
              zIndex: slot.z,
            }}
          >
            <span className="absolute -left-1.5 top-1/2 z-0 h-2.5 w-3 -translate-y-1/2 rounded-md bg-[linear-gradient(180deg,#ecc873,#a9791f)]" />
            <span className="absolute -right-1.5 top-1/2 z-0 h-2.5 w-3 -translate-y-1/2 rounded-md bg-[linear-gradient(180deg,#ecc873,#a9791f)]" />
            <div className="relative z-[1] h-full w-full rounded-[11px] bg-[linear-gradient(150deg,#efcd7d,#c79433_55%,#9c6f1f)] p-1.5 shadow-[0_9px_16px_rgba(0,0,0,0.4)]">
              <div className="relative h-full w-full overflow-hidden rounded-md bg-[linear-gradient(160deg,#fbfdfe_0%,#d2d8de_42%,#9aa1a9_100%)] shadow-[inset_0_2px_6px_rgba(255,255,255,0.55),inset_0_-5px_11px_rgba(0,0,0,0.3)]">
                {dish ? (
                  <>
                    <img
                      src={getDishImage(dish)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]"
                    />
                    <div className="absolute bottom-1 left-1/2 z-[6] max-w-[90%] -translate-x-1/2 truncate rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-extrabold text-foreground shadow-sm sm:text-[10px]">
                      {dish.name}
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-muted-foreground/75">
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-muted-foreground/50">
                      <Plus className="h-3 w-3" strokeWidth={2.4} />
                    </span>
                    <span className="font-serif text-[10px] italic">Add Item</span>
                  </div>
                )}
              </div>
            </div>
            <span className="absolute bottom-[-5px] left-[20%] z-0 h-2 w-2 rounded-b-[3px] bg-[#a9791f]" />
            <span className="absolute bottom-[-5px] right-[20%] z-0 h-2 w-2 rounded-b-[3px] bg-[#a9791f]" />
          </div>
        );
      })}
    </div>
  );
}

function DishCatalogue({
  categories,
  category,
  counts,
  diet,
  onCategoryChange,
  onClearSearch,
  onDietChange,
  onToggleDish,
  search,
  selectedIds,
  setSearch,
  visible,
}: {
  categories: Array<{ id: CategoryFilter; label: string }>;
  category: CategoryFilter;
  counts: Record<CategoryFilter, number>;
  diet: DietFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onClearSearch: () => void;
  onDietChange: (diet: DietFilter) => void;
  onToggleDish: (id: DishId) => void;
  search: string;
  selectedIds: Set<DishId>;
  setSearch: (value: string) => void;
  visible: Dish[];
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_8px_22px_rgba(45,31,20,0.045)] lg:sticky lg:top-20 lg:max-h-[calc(100vh-96px)]">
      <div className="shrink-0 border-b border-border p-3">
        <div className="space-y-2.5">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-[#fbf8f2] px-3 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Search dishes</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dishes..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear dish search"
                onClick={onClearSearch}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-primary hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div
            className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-[#fbf8f2] p-1"
            role="radiogroup"
            aria-label="Diet filter"
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'veg', label: 'Veg', dot: 'bg-emerald-600' },
              { id: 'nonveg', label: 'Non-veg', dot: 'bg-red-600' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={diet === option.id}
                onClick={() => onDietChange(option.id as DietFilter)}
                className={cn(
                  'flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  diet === option.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-foreground hover:border-primary/30 hover:text-primary',
                )}
              >
                {option.dot && (
                  <span className={cn('h-2 w-2 rounded-full', option.dot)} />
                )}
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCategoryChange(cat.id)}
                  className={cn(
                    'min-h-9 shrink-0 rounded-full border px-2.5 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    active
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-foreground hover:border-primary/35 hover:text-primary',
                  )}
                >
                  {cat.label}
                  <span className={cn('ml-1.5', active ? 'text-white/75' : 'text-muted-foreground')}>
                    {counts[cat.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-visible p-2 lg:overflow-y-auto">
        <div className="space-y-2">
          {visible.map((dish) => {
            const selected = selectedIds.has(dish.id);
            return (
              <article
                key={dish.id}
                className="grid min-h-[88px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 transition hover:border-primary/25 hover:bg-[#fffdf8]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <VegDot veg={dish.veg} />
                    <h3 className="min-w-0 text-[15px] font-bold leading-tight text-foreground">
                      {dish.name}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {dish.categoryName}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span className="text-[13px] font-extrabold text-foreground">
                      {formatCurrency(dish.price)} / plate
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleDish(dish.id)}
                  className={cn(
                    'inline-flex min-h-10 w-fit min-w-[84px] items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    selected
                      ? 'border-primary bg-primary text-white hover:bg-primary/90'
                      : 'border-primary/45 bg-white text-primary hover:bg-primary/5',
                  )}
                >
                  {selected ? (
                    <>
                      Added <Check className="h-4 w-4" />
                    </>
                  ) : (
                    'Add'
                  )}
                </button>
              </article>
            );
          })}
        </div>

        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-[#fbf8f2] px-4 py-8 text-center">
            <p className="text-sm font-bold text-foreground">
              No dishes match your search.
            </p>
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-3 min-h-11 rounded-full border border-primary/35 bg-white px-5 text-sm font-extrabold text-primary transition hover:bg-primary/5"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SummaryPanel({
  estimatedSubtotal,
  guestCount,
  message,
  nonVegCount,
  onAddToCart,
  order,
  saving,
  subtotalPerPlate,
  vegCount,
}: {
  estimatedSubtotal: number;
  guestCount: number;
  message: string;
  nonVegCount: number;
  onAddToCart: () => void;
  order: DishId[];
  saving: boolean;
  subtotalPerPlate: number;
  vegCount: number;
}) {
  return (
    <aside className="rounded-2xl border border-border bg-white p-4 shadow-[0_8px_22px_rgba(45,31,20,0.045)] lg:sticky lg:top-20">
      <p className="eyebrow text-primary">Live Summary</p>
      <h2 className="mt-1 font-serif text-xl font-bold">Your package</h2>
      {order.length === 0 && (
        <div className="mt-3 rounded-xl border border-border bg-[#fbf8f2] p-3 text-sm">
          <ShoppingBag className="mb-2 h-4 w-4 text-primary" />
          <p className="font-bold text-foreground">No dishes added yet</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Add dishes from the menu to build your package.
          </p>
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-[#fbf8f2]">
        {[
          ['Items', order.length],
          ['Veg', vegCount],
          ['Non-veg', nonVegCount],
        ].map(([label, value]) => (
          <div key={label} className="p-2.5">
            <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 font-serif text-xl font-bold text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Guests</span>
          <strong>{guestCount}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Per guest estimate</span>
          <strong>{subtotalPerPlate ? formatCurrency(subtotalPerPlate) : '-'}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-primary">Estimated subtotal</span>
          <strong className="text-primary">
            {estimatedSubtotal ? formatCurrency(estimatedSubtotal) : '-'}
          </strong>
        </div>
        <div className="flex justify-between gap-4 rounded-xl bg-primary/[0.055] p-2.5">
          <span className="font-extrabold text-primary">Estimated total</span>
          <strong className="text-primary">
            {estimatedSubtotal ? formatCurrency(estimatedSubtotal) : '-'}
          </strong>
        </div>
        <p className="text-xs text-muted-foreground">Excluding taxes</p>
      </div>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          className="min-h-11 rounded-full border border-primary/35 bg-white px-4 text-sm font-extrabold text-primary transition hover:bg-primary/5"
        >
          View Summary
        </button>
        <button
          type="button"
          disabled={order.length === 0 || saving}
          onClick={onAddToCart}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-extrabold text-white transition hover:bg-primary/90 disabled:bg-primary/35"
        >
          <ShoppingBag className="h-4 w-4" /> {saving ? 'Adding...' : 'Add to Cart'}
        </button>
        {order.length === 0 && (
          <p className="text-center text-xs font-semibold text-muted-foreground">
            Add at least one dish to continue.
          </p>
        )}
        {message && (
          <p className="rounded-lg border border-red-100 bg-red-50 p-2 text-xs font-semibold text-red-800">
            {message}
          </p>
        )}
      </div>
    </aside>
  );
}

export default function BuildPackagePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background p-4">
          <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
        </main>
      }
    >
      <BuildPackageContent />
    </Suspense>
  );
}

function BuildPackageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSessionStore((state) => state.session);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const packageVersionId = searchParams.get('packageVersionId');
  const [cat, setCat] = useState<CategoryFilter>('all');
  const [diet, setDiet] = useState<DietFilter>('all');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<DishId[]>([]);
  const [guestCount, setGuestCount] = useState(150);
  const [guestInput, setGuestInput] = useState('150');
  const [mobileTab, setMobileTab] = useState<MobileTab>('visual');
  const [dishes, setDishes] = useState<Dish[]>(FALLBACK_DISHES);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!packageVersionId) return;
    let active = true;
    apiRequest<PackageConfiguration>(
      `/package-versions/${packageVersionId}/configuration`,
    )
      .then((nextConfig) => {
        if (!active) return;
        const nextDishes = dishesFromConfig(nextConfig);
        setConfig(nextConfig);
        setDishes(nextDishes.length ? nextDishes : FALLBACK_DISHES);
        setClampedGuestCount(nextConfig.minGuestCount || MIN_GUESTS);
        setOrder((current) =>
          current.filter((id) => nextDishes.some((dish) => dish.id === id)),
        );
      })
      .catch((reason) => {
        if (active) setMessage((reason as Error).message);
      });
    return () => {
      active = false;
    };
  }, [packageVersionId]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dishes.filter((dish) => {
      const matchesCategory = cat === 'all' || dish.cat === cat;
      const matchesDiet =
        diet === 'all' || (diet === 'veg' ? dish.veg : !dish.veg);
      const matchesSearch = !query || dish.name.toLowerCase().includes(query);
      return matchesCategory && matchesDiet && matchesSearch;
    });
  }, [cat, diet, dishes, search]);

  const categories = useMemo<Array<{ id: CategoryFilter; label: string }>>(() => {
    if (dishes === FALLBACK_DISHES) return CATS;
    const seen = new Map<string, string>();
    for (const dish of dishes) seen.set(dish.categoryId, dish.categoryName);
    return [
      { id: 'all', label: 'All' },
      ...Array.from(seen.entries()).map(([id, label]) => ({ id, label })),
    ];
  }, [dishes]);

  const counts = useMemo(() => {
    const initial = Object.fromEntries(categories.map((cat) => [cat.id, 0])) as Record<
      CategoryFilter,
      number
    >;
    for (const dish of dishes) {
      initial.all += 1;
      initial[dish.cat] += 1;
    }
    return initial;
  }, [categories, dishes]);

  const addedIds = useMemo(() => new Set(order), [order]);
  const dishMap = useMemo(
    () => Object.fromEntries(dishes.map((dish) => [dish.id, dish])) as Record<string, Dish>,
    [dishes],
  );
  const vegCount = order.filter((id) => dishMap[id]?.veg).length;
  const nonVegCount = order.length - vegCount;
  const subtotalPerPlate = order.reduce(
    (sum, id) => sum + (dishMap[id]?.price ?? 0),
    0,
  );
  const estimatedSubtotal = subtotalPerPlate * guestCount;

  function setClampedGuestCount(value: number) {
    const next = clampGuestCount(value);
    setGuestCount(next);
    setGuestInput(String(next));
  }

  function handleGuestInput(value: string) {
    const digits = value.replace(/\D/g, '');
    setGuestInput(digits);
    if (!digits) return;
    setGuestCount(clampGuestCount(Number(digits)));
  }

  function handleGuestBlur() {
    if (!guestInput) {
      setGuestInput(String(guestCount));
      return;
    }
    setClampedGuestCount(Number(guestInput));
  }

  function toggleDish(id: DishId) {
    setOrder((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 12) return current;
      return [...current, id];
    });
  }

  function clear() {
    setOrder([]);
  }

  async function addToCart() {
    if (saving || order.length === 0) return;
    if (!packageVersionId) {
      setMessage('Choose a package before adding dishes to cart.');
      return;
    }
    if (!session) {
      const query = searchParams.toString();
      router.push(
        `/login?returnTo=${encodeURIComponent(
          query ? `/packages/build?${query}` : '/packages/build',
        )}`,
      );
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const cart = await apiRequest<CartSummary>(
        '/cart',
        {
          method: 'PUT',
          body: JSON.stringify({ packageVersionId }),
        },
        session.accessToken,
      );
      setDbCartId(cart.id, session.user.id);
      await apiRequest(
        '/cart/items',
        {
          method: 'PUT',
          body: JSON.stringify({
            items: order
              .map((id) => dishMap[id])
              .filter(Boolean)
              .map((dish) => ({
                categoryId: dish.categoryId,
                menuItemId: dish.id,
                role: config?.packageType === 'FIXED_PACKAGE' ? 'EXTRA' : 'CUSTOM',
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

  const catalogue = (
    <DishCatalogue
      category={cat}
      counts={counts}
      categories={categories}
      diet={diet}
      onCategoryChange={setCat}
      onClearSearch={() => setSearch('')}
      onDietChange={setDiet}
      onToggleDish={toggleDish}
      search={search}
      selectedIds={addedIds}
      setSearch={setSearch}
      visible={visible}
    />
  );

  const visual = (
    <section className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-[560px]">
          <h1 className="font-serif text-[30px] font-bold leading-[1.05] text-foreground">
            Build Your Own Package
          </h1>
          <p className="mt-1 text-sm font-semibold leading-5 text-muted-foreground">
            Choose your favourite dishes and customize a menu that fits your occasion.
          </p>
        </div>
        <div className="shrink-0 sm:w-[244px]">
          <GuestStepper
            guestCount={guestCount}
            guestInput={guestInput}
            onInputBlur={handleGuestBlur}
            onInputChange={handleGuestInput}
            onStep={(delta) => setClampedGuestCount(guestCount + delta)}
          />
        </div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(40,20,10,0.32),rgba(40,20,10,0.5)),url('/order-occasion.png')] bg-cover bg-center shadow-[0_8px_22px_rgba(45,31,20,0.045)]">
        {order.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-3 z-40 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-xs font-extrabold text-primary shadow-sm transition hover:bg-primary hover:text-white"
          >
            <Trash2 className="h-4 w-4" /> Clear All
          </button>
        )}
        <BanquetTable dishMap={dishMap} order={order} />
      </div>
    </section>
  );

  const summary = (
    <SummaryPanel
      estimatedSubtotal={estimatedSubtotal}
      guestCount={guestCount}
      message={message}
      nonVegCount={nonVegCount}
      onAddToCart={addToCart}
      order={order}
      saving={saving}
      subtotalPerPlate={subtotalPerPlate}
      vegCount={vegCount}
    />
  );

  return (
    <main className="min-h-screen overflow-x-clip bg-background pb-28 lg:pb-16">
      <div className="lg:hidden">
        <div className="mx-auto grid max-w-[720px] grid-cols-3 gap-1 px-4 py-3">
          {[
            ['dishes', 'Add Dishes'],
            ['visual', 'Visual Package'],
            ['summary', 'Summary'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id as MobileTab)}
              className={cn(
                'min-h-11 rounded-full border px-2 text-xs font-extrabold transition',
                mobileTab === id
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1480px] gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[330px_minmax(0,1fr)_286px] lg:items-start lg:px-6">
        <div className={cn(mobileTab === 'dishes' ? 'block' : 'hidden', 'lg:block')}>
          {catalogue}
        </div>
        <div className={cn(mobileTab === 'visual' ? 'block' : 'hidden', 'lg:block')}>
          {visual}
        </div>
        <div className={cn(mobileTab === 'summary' ? 'block' : 'hidden', 'lg:block')}>
          {summary}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white p-3 shadow-[0_-8px_24px_rgba(45,31,20,0.10)] lg:hidden">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground">
              {order.length} selected for {guestCount} guests
            </p>
            <p className="truncate font-serif text-xl font-bold text-primary">
              {estimatedSubtotal ? formatCurrency(estimatedSubtotal) : 'Select dishes'}
            </p>
          </div>
          <button
            type="button"
            disabled={order.length === 0 || saving}
            onClick={addToCart}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-white disabled:bg-primary/35"
          >
            {saving ? 'Adding...' : 'Add to Cart'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </main>
  );
}
