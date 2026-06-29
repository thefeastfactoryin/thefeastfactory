'use client';

import type { LucideIcon } from 'lucide-react';
import type { PackageConfiguration, PackageSummary } from '@aranyam/shared-types';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  Cookie,
  Flame,
  Leaf,
  Lock,
  Minus,
  Package,
  Plus,
  Shield,
  ShieldCheck,
  Soup,
  Truck,
  Users,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatePanel } from '../../../components/ui/state-panel';
import { apiRequest } from '../../../lib/api';
import { useOrderBuilderStore } from '../../../store/order-builder.store';
import { cn } from '../../../lib/utils';

/* static display data */

const BOX_DISPLAY_NAMES = ['3 Item Box', '5 Item Box', '8 Item Box'] as const;
const BOX_NUMS          = ['3', '5', '8'] as const;

type BoxMeta = { image: string; chips: { Icon: LucideIcon; label: string }[]; popular?: true };

const BOX_META: BoxMeta[] = [
  {
    image: '/tray-3.png',
    chips: [
      { Icon: UtensilsCrossed, label: '1 Main Course' },
      { Icon: Wheat,           label: '1 Rice / Bread' },
      { Icon: Cookie,          label: '1 Dessert' },
    ],
  },
  {
    image: '/tray-5.png',
    chips: [
      { Icon: Flame,           label: '1 Starter' },
      { Icon: UtensilsCrossed, label: '1 Main Course' },
      { Icon: Wheat,           label: '1 Rice / Bread' },
      { Icon: Coffee,          label: '1 Beverage' },
      { Icon: Cookie,          label: '1 Dessert' },
    ],
    popular: true,
  },
  {
    image: '/tray-8.png',
    chips: [
      { Icon: Flame,           label: '2 Starters' },
      { Icon: UtensilsCrossed, label: '1 Main Course' },
      { Icon: Wheat,           label: '1 Rice / Bread' },
      { Icon: Soup,            label: '1 Dal' },
      { Icon: Leaf,            label: '1 Sabzi' },
      { Icon: Coffee,          label: '1 Beverage' },
      { Icon: Cookie,          label: '1 Dessert' },
    ],
  },
];

/* sidebar-only static dish lists (no API call needed for sidebar preview) */
type SampleDish = { category: string; name: string; image: string };

const BOX_VEG_DISHES: SampleDish[][] = [
  [
    { category: 'Main Course',  name: 'Paneer Butter Masala', image: '/inc-main.png'     },
    { category: 'Rice / Bread', name: 'Steamed Basmati Rice', image: '/inc-rice.png'     },
    { category: 'Dessert',      name: 'Gulab Jamun',          image: '/inc-dessert.png'  },
  ],
  [
    { category: 'Starter',      name: 'Veg Manchurian',       image: '/inc-starter.png'  },
    { category: 'Main Course',  name: 'Paneer Butter Masala', image: '/inc-main.png'     },
    { category: 'Rice / Bread', name: 'Steamed Rice',         image: '/inc-rice.png'     },
    { category: 'Beverage',     name: 'Fresh Lime Juice',     image: '/inc-beverage.png' },
    { category: 'Dessert',      name: 'Gulab Jamun',          image: '/inc-dessert.png'  },
  ],
  [
    { category: 'Starter',      name: 'Veg Manchurian',       image: '/inc-starter.png'  },
    { category: 'Starter',      name: 'Paneer Tikka',         image: '/inc-starter.png'  },
    { category: 'Main Course',  name: 'Dal Makhani',          image: '/inc-main.png'     },
    { category: 'Rice / Bread', name: 'Steamed Rice',         image: '/inc-rice.png'     },
    { category: 'Rice / Bread', name: 'Butter Naan',          image: '/inc-rice.png'     },
    { category: 'Beverage',     name: 'Fresh Lime Juice',     image: '/inc-beverage.png' },
    { category: 'Dessert',      name: 'Gulab Jamun',          image: '/inc-dessert.png'  },
    { category: 'Premium',      name: 'Rasgulla',             image: '/inc-dessert.png'  },
  ],
];

const BOX_NONVEG_DISHES: SampleDish[][] = [
  [
    { category: 'Main Course',  name: 'Butter Chicken',       image: '/inc-main.png'     },
    { category: 'Rice / Bread', name: 'Steamed Basmati Rice', image: '/inc-rice.png'     },
    { category: 'Dessert',      name: 'Gulab Jamun',          image: '/inc-dessert.png'  },
  ],
  [
    { category: 'Starter',      name: 'Chicken Tikka',        image: '/inc-starter.png'  },
    { category: 'Main Course',  name: 'Butter Chicken',       image: '/inc-main.png'     },
    { category: 'Rice / Bread', name: 'Steamed Rice',         image: '/inc-rice.png'     },
    { category: 'Beverage',     name: 'Fresh Lime Juice',     image: '/inc-beverage.png' },
    { category: 'Dessert',      name: 'Gulab Jamun',          image: '/inc-dessert.png'  },
  ],
  [
    { category: 'Starter',      name: 'Chicken Tikka',        image: '/inc-starter.png'  },
    { category: 'Starter',      name: 'Prawn 65',             image: '/inc-starter.png'  },
    { category: 'Main Course',  name: 'Mutton Masala',        image: '/inc-main.png'     },
    { category: 'Rice / Bread', name: 'Steamed Rice',         image: '/inc-rice.png'     },
    { category: 'Rice / Bread', name: 'Butter Naan',          image: '/inc-rice.png'     },
    { category: 'Beverage',     name: 'Fresh Lime Juice',     image: '/inc-beverage.png' },
    { category: 'Dessert',      name: 'Gulab Jamun',          image: '/inc-dessert.png'  },
    { category: 'Premium',      name: 'Fish Tikka',           image: '/inc-starter.png'  },
  ],
];

const INFO_CARDS: { Icon: LucideIcon; label: string; desc: string }[] = [
  { Icon: Users,       label: 'Perfect for',      desc: 'Corporate Lunches, Trainings, Events & Community Meals' },
  { Icon: Package,     label: 'Minimum Order',    desc: '20 Boxes' },
  { Icon: ShieldCheck, label: 'Hygienic & Fresh', desc: 'Prepared daily' },
  { Icon: Truck,       label: 'On-time Delivery', desc: 'Always on schedule' },
];

const BOTTOM_FEATURES: { Icon: LucideIcon; label: string; desc: string }[] = [
  { Icon: Leaf,   label: 'Fresh Ingredients',  desc: 'Sourced daily for the best taste' },
  { Icon: Shield, label: 'Hygienic Packaging', desc: 'Food safe and tamper-proof' },
  { Icon: Check,  label: 'Balanced Nutrition', desc: 'Curated for a wholesome meal' },
  { Icon: Clock,  label: 'Timely Delivery',    desc: 'Always on time, every time' },
];

/* ToggleDot (Veg/Non-Veg pill buttons) */

function ToggleDot({ type, active }: { type: 'veg' | 'non-veg'; active: boolean }) {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-current">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          active ? 'bg-white' : type === 'veg' ? 'bg-green-600' : 'bg-red-600',
        )}
      />
    </span>
  );
}

/* VegDot (item-level veg/non-veg indicator) */

function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#16a34a' : '#dc2626';
  return (
    <span
      style={{
        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
        border: `2px solid ${color}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'block' }} />
    </span>
  );
}

/* BoxCard */

function BoxCard({
  pkg,
  index,
  isExpanded,
  isChosen,
  config,
  isLoadingConfig,
  chosenPricePerPlate,
  qty,
  onExpand,
  onChoose,
}: {
  pkg:                 PackageSummary;
  index:               number;
  isExpanded:          boolean;
  isChosen:            boolean;
  config:              PackageConfiguration | undefined;
  isLoadingConfig:     boolean;
  chosenPricePerPlate: number | null;
  qty:                 number;
  onExpand:            () => void;
  onChoose:            () => void;
}) {
  const meta        = BOX_META[index];
  const displayName = BOX_DISPLAY_NAMES[index] ?? pkg.name;
  if (!meta) return null;

  return (
    <article
      className={cn(
        'group overflow-hidden rounded-[22px] border border-[hsl(35_22%_86%)] bg-white shadow-[0_10px_28px_rgba(45,31,20,0.07)] transition-all duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-1 hover:border-[hsl(41_45%_74%)] hover:shadow-[0_18px_42px_rgba(45,31,20,0.11)]',
        isChosen && 'border-primary/45 shadow-[0_18px_44px_rgba(128,18,34,0.16)] ring-2 ring-primary/18',
      )}
    >
      <div className="relative overflow-hidden bg-[hsl(39_50%_96%)]">
        <img
          src={meta.image}
          alt={displayName}
          className="aspect-[16/10] w-full object-cover transition-transform duration-500 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.035]"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/42 to-transparent" />
        {meta.popular && (
          <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-[hsl(41_56%_52%)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white shadow-sm">
            Most Ordered
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-white/92 px-3 py-1 text-xs font-extrabold text-primary shadow-sm ring-1 ring-white/70">
          {displayName}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {meta.chips.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(35_22%_87%)] bg-[hsl(39_50%_97%)] px-2.5 py-1 text-[10.5px] font-bold text-[hsl(0_0%_28%)]"
            >
              <Icon className="h-3 w-3 shrink-0 text-primary/80" />
              {label}
            </span>
          ))}
        </div>

        <p className="mt-3 text-[12px] font-semibold text-muted-foreground">Serves 1 person</p>

        <div className="mt-2.5 flex flex-col items-start gap-3">
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-[28px] font-extrabold leading-none text-primary">
              ₹{pkg.activeVersion?.basePricePerPlate}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">per box</span>
          </div>
          <button
            onClick={onExpand}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-extrabold shadow-[0_6px_16px_rgba(122,31,43,0.08)] transition-all duration-[250ms] [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5',
              isExpanded
                ? 'bg-primary text-white'
                : 'border border-primary bg-white text-primary hover:bg-primary hover:text-white',
            )}
          >
            {isExpanded ? 'Hide details' : 'View details'}
            {isExpanded
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Inline expanded details panel */}
      {isExpanded && (
        <div className="border-t border-[hsl(35_22%_88%)] bg-[hsl(39_50%_97%)] p-5">
          {isLoadingConfig ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : config ? (
            <>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Included Items
              </p>

              <div className="space-y-1">
                {config.categoryRules.flatMap((rule) =>
                  rule.items.slice(0, rule.maxSelections).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-[hsl(35_22%_88%)] bg-white px-2.5 py-1.5"
                    >
                      <VegDot isVeg={item.isVeg} />
                      <span className="text-[12px] font-medium text-foreground">
                        {item.name}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 border-t border-[hsl(35_22%_88%)] pt-4">
                <p className="text-[11px] font-semibold text-muted-foreground">Starting from</p>
                <p className="mt-0.5 font-serif text-lg font-extrabold text-primary">
                  ₹{config.basePricePerPlate}
                  <span className="ml-0.5 font-sans text-xs font-semibold text-muted-foreground"> per box</span>
                </p>
              </div>
            </>
          ) : (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Details unavailable for this box.
            </p>
          )}

          {/* Swap diff callout - shown when another box is already chosen */}
          {!isChosen && chosenPricePerPlate !== null && config && (() => {
            const thisPrice = parseFloat(config.basePricePerPlate as unknown as string);
            const diff      = thisPrice - chosenPricePerPlate;
            const diffTotal = diff * qty;
            const sign      = diff >= 0 ? '+' : '−';
            const absDiff   = Math.abs(diff);
            const absDiffTotal = Math.abs(diffTotal);
            return (
              <div className={cn(
                'mt-4 rounded-xl border px-3 py-2.5 text-xs font-semibold',
                diff > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : diff < 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-border bg-muted text-muted-foreground',
              )}>
                {diff === 0 ? (
                  'Same price as your current selection'
                ) : (
                  <>
                    {sign}₹{absDiff.toLocaleString('en-IN')} per box · {sign}₹{absDiffTotal.toLocaleString('en-IN')} total for {qty} boxes
                  </>
                )}
              </div>
            );
          })()}

          {/* CTA: Added to Cart / Swap / Choose */}
          <button
            onClick={onChoose}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-extrabold shadow-[0_10px_24px_rgba(128,18,34,0.16)] transition-all duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5',
              isChosen
                ? 'bg-emerald-600 text-white'
                : chosenPricePerPlate !== null
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-primary text-white hover:bg-primary/90',
            )}
          >
            {isChosen ? (
              <><Check className="h-4 w-4" /> Added to Cart</>
            ) : chosenPricePerPlate !== null ? (
              <><ArrowRight className="h-4 w-4" /> Swap to this box</>
            ) : (
              'Choose Meal Box'
            )}
          </button>
        </div>
      )}
    </article>
  );
}

/* OrderSidebar */

function OrderSidebar({
  pkg,
  index,
  vegMode,
  qty,
  onQtyChange,
  onContinue,
  onEditBox,
}: {
  pkg:         PackageSummary | null;
  index:       number | null;
  vegMode:     'veg' | 'non-veg';
  qty:         number;
  onQtyChange: (n: number) => void;
  onContinue:  () => void;
  onEditBox:   () => void;
}) {
  const meta        = index !== null ? (BOX_META[index] ?? null) : null;
  const displayName = index !== null
    ? `${BOX_NUMS[index] ?? ''} Item ${vegMode === 'veg' ? 'Veg' : 'Non-Veg'} Box`
    : '';
  const sampleDishes = index !== null
    ? ((vegMode === 'veg' ? BOX_VEG_DISHES : BOX_NONVEG_DISHES)[index] ?? [])
    : [];
  const price    = parseFloat(pkg?.activeVersion?.basePricePerPlate ?? '0');
  const subtotal = price * qty;
  const minQty   = pkg?.activeVersion?.minGuestCount ?? 20;

  return (
    <div className="overflow-hidden rounded-[24px] border border-[hsl(35_22%_86%)] bg-white shadow-[0_16px_42px_rgba(45,31,20,0.09)]">

      <div className="flex items-center justify-between border-b border-[hsl(35_22%_88%)] bg-[hsl(39_50%_97%)] px-5 py-4">
        <span className="text-base font-bold text-foreground">Your Order</span>
        {pkg && (
          <button
            onClick={onEditBox}
            className="rounded-full border border-[hsl(35_22%_84%)] bg-white px-3 py-1 text-xs font-bold text-foreground transition-all duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:border-primary/30 hover:text-primary"
          >
            Edit Box
          </button>
        )}
      </div>

      {pkg && meta ? (
        <>
          <div className="flex items-center gap-3 border-b border-[hsl(35_22%_88%)] px-5 py-4">
            <img src={meta.image} alt={displayName} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            <div>
              <p className="font-semibold text-foreground">{displayName}</p>
              <p className="text-sm text-muted-foreground">₹{pkg.activeVersion?.basePricePerPlate} per box</p>
            </div>
          </div>

          <div className="border-b border-[hsl(35_22%_88%)] px-5 py-4">
            <p className="font-semibold text-foreground">How many boxes?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Minimum order: {minQty} boxes</p>
            <div className="mt-4 inline-flex items-center gap-4 rounded-full border border-[hsl(35_22%_86%)] bg-[hsl(39_50%_97%)] p-1.5">
              <button
                onClick={() => onQtyChange(Math.max(minQty, qty - 10))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-[hsl(35_22%_84%)] transition hover:-translate-y-0.5 hover:ring-primary/30 disabled:opacity-50"
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-14 text-center font-serif text-2xl font-extrabold tabular-nums text-foreground">{qty}</span>
              <button
                onClick={() => onQtyChange(qty + 10)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-[hsl(35_22%_84%)] transition hover:-translate-y-0.5 hover:ring-primary/30 disabled:opacity-50"
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{qty} Boxes</p>
          </div>

          {/* <div className="border-b border-border px-5 py-4">
            <p className="font-semibold text-foreground">What's included in your box</p>
            <ul className="mt-3 space-y-3">
              {sampleDishes.map((dish, i) => (
                <li key={i} className="flex items-center gap-3">
                  <img src={dish.image} alt={dish.name} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{dish.category}</p>
                    <p className="text-sm font-medium text-foreground">{dish.name}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div> */}

          <div className="border-b border-[hsl(35_22%_88%)] px-5 py-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal ({qty} boxes)</span>
                <span className="font-semibold text-foreground">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span className="font-semibold text-emerald-600">FREE</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[hsl(35_22%_88%)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estimated Total</p>
              <p className="mt-1 font-serif text-3xl font-extrabold text-foreground">
                ₹{subtotal.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="px-5 py-4">
            <button
              onClick={onContinue}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(122,31,43,0.16)] transition-all duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Add to Cart <ArrowRight className="h-4 w-4" />
            </button>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              Secure & Safe Payments
            </div>
          </div>
        </>
      ) : (
        <div className="px-5 py-6">
          <div className="rounded-2xl border border-dashed border-[hsl(35_22%_82%)] bg-[hsl(39_50%_97%)] px-4 py-5 text-center">
            <p className="text-sm font-semibold text-foreground">No box selected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click "View details" then "Choose Meal Box" to add one.
            </p>
          </div>
          <div className="mt-5">
            <p className="font-semibold text-foreground">How many boxes?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Minimum order: 20 boxes</p>
            <div className="mt-4 inline-flex items-center gap-4 rounded-full border border-[hsl(35_22%_86%)] bg-[hsl(39_50%_97%)] p-1.5">
              <button
                onClick={() => onQtyChange(Math.max(20, qty - 10))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-[hsl(35_22%_84%)] transition hover:-translate-y-0.5 hover:ring-primary/30 disabled:opacity-50"
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-14 text-center font-serif text-2xl font-extrabold tabular-nums text-foreground">{qty}</span>
              <button
                onClick={() => onQtyChange(qty + 10)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-[hsl(35_22%_84%)] transition hover:-translate-y-0.5 hover:ring-primary/30 disabled:opacity-50"
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{qty} Boxes</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* PageSkeleton */

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-52 animate-pulse rounded-full bg-muted" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-border">
            <div className="aspect-[16/10] animate-pulse bg-muted" />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                ))}
              </div>
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Page */

export default function MealBoxesPage() {
  const router        = useRouter();
  const setPackage    = useOrderBuilderStore((s) => s.setPackage);
  const setGuestCount = useOrderBuilderStore((s) => s.setGuestCount);

  const [vegPackages,    setVegPackages]    = useState<PackageSummary[]>([]);
  const [nonVegPackages, setNonVegPackages] = useState<PackageSummary[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [expandedIdx,    setExpandedIdx]    = useState<number | null>(null);
  const [chosenIdx,      setChosenIdx]      = useState<number | null>(null);
  const [vegMode,        setVegMode]        = useState<'veg' | 'non-veg'>('veg');
  const [qty,            setQty]            = useState(100);

  /* config cache keyed by package version id */
  const [configs,          setConfigs]          = useState<Record<string, PackageConfiguration>>({});
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<PackageSummary[]>('/packages')
      .then((pkgs) => {
        const mealBoxes = pkgs
          .filter((p) => p.type === 'MEAL_BOX' && p.activeVersion)
          .sort(
            (a, b) =>
              parseFloat(a.activeVersion!.basePricePerPlate) -
              parseFloat(b.activeVersion!.basePricePerPlate),
          );
        setVegPackages(mealBoxes.filter((p) => !p.name.toLowerCase().includes('non')).slice(0, 3));
        setNonVegPackages(mealBoxes.filter((p) => p.name.toLowerCase().includes('non')).slice(0, 3));
      })
      .catch((r) => setError(r.message))
      .finally(() => setLoading(false));
  }, []);

  const packages    = vegMode === 'veg' ? vegPackages : nonVegPackages;
  const selectedPkg = chosenIdx !== null ? (packages[chosenIdx] ?? null) : null;

  const selectedDisplayName = chosenIdx !== null
    ? `${BOX_NUMS[chosenIdx] ?? ''} Item ${vegMode === 'veg' ? 'Veg' : 'Non-Veg'} Box`
    : '';

  function handleExpand(idx: number) {
    const next = expandedIdx === idx ? null : idx;
    setExpandedIdx(next);

    /* load configuration on expand if not cached yet */
    if (next === null) return;
    const versionId = packages[next]?.activeVersion?.id;
    if (!versionId || configs[versionId]) return;

    setLoadingVersionId(versionId);
    apiRequest<PackageConfiguration>(`/package-versions/${versionId}/configuration`)
      .then((config) => setConfigs((prev) => ({ ...prev, [versionId]: config })))
      .catch(() => {})
      .finally(() => setLoadingVersionId(null));
  }

  function handleChoose(idx: number) {
    setChosenIdx(idx);
    const minQ = packages[idx]?.activeVersion?.minGuestCount ?? 20;
    setQty((q) => Math.max(q, minQ));
  }

  function handleVegModeChange(mode: 'veg' | 'non-veg') {
    setVegMode(mode);
    setExpandedIdx(null);
    setChosenIdx(null);
  }

  function handleContinue() {
    if (!selectedPkg?.activeVersion) return;
    setPackage({
      packageId:         selectedPkg.id,
      packageVersionId:  selectedPkg.activeVersion.id,
      packageName:       selectedPkg.name,
      isCustom:          selectedPkg.isCustom,
      basePricePerPlate: selectedPkg.activeVersion.basePricePerPlate,
      minGuestCount:     selectedPkg.activeVersion.minGuestCount,
      maxGuestCount:     selectedPkg.activeVersion.maxGuestCount,
    });
    setGuestCount(qty);
    router.push(`/events/new?packageVersionId=${selectedPkg.activeVersion.id}`);
  }

  return (
    <main className="min-h-screen bg-[hsl(37_38%_96%)] pb-40 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 pb-7 pt-9 sm:px-6 lg:px-8">

        {/* Page header */}
        <section className="mb-7 rounded-[24px] border border-[hsl(35_22%_86%)] bg-[linear-gradient(135deg,hsl(39_50%_98%),hsl(37_36%_94%))] px-4 py-5 shadow-[0_10px_30px_rgba(45,31,20,0.055)] sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.22em] text-[hsl(41_56%_43%)]">Packed Meals for Groups</p>
              <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">Meal Boxes</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">Delicious, balanced meals. Perfectly portioned.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 lg:min-w-[620px] lg:grid-cols-4">
              {INFO_CARDS.map(({ Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-[18px] border border-[hsl(35_22%_86%)] bg-[hsl(39_50%_97%)] px-3 py-2.5 shadow-[0_4px_14px_rgba(45,31,20,0.035)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(352_40%_95%)]">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-extrabold text-foreground">{label}</p>
                    <p className="text-[10.5px] leading-snug text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        {error && (
          <StatePanel
            tone="danger"
            title="Could not load meal boxes"
            description={error}
            actionHref="/packages"
            actionLabel="Browse all packages"
          />
        )}

        {/* Two-column layout */}
        <div className="lg:flex lg:items-start lg:gap-8">

          {/* Left: main content */}
          <div className="min-w-0 flex-1 space-y-6">

            {!error && loading && <PageSkeleton />}

            {!error && !loading && (
              <>
                {/* Veg / Non-Veg toggle */}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(35_22%_86%)] bg-white p-1 shadow-[0_5px_18px_rgba(45,31,20,0.045)]">
                  <button
                    onClick={() => handleVegModeChange('veg')}
                    className={cn(
                       'inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition-all duration-[250ms] [transition-timing-function:cubic-bezier(.22,.61,.36,1)]',
                      vegMode === 'veg'
                        ? 'bg-primary text-white shadow-[0_6px_16px_rgba(122,31,43,0.16)]'
                        : 'text-foreground/70 hover:bg-[hsl(39_50%_97%)] hover:text-foreground',
                    )}
                  >
                    <ToggleDot type="veg" active={vegMode === 'veg'} />
                    Veg
                  </button>
                  <button
                    onClick={() => handleVegModeChange('non-veg')}
                    className={cn(
                       'inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition-all duration-[250ms] [transition-timing-function:cubic-bezier(.22,.61,.36,1)]',
                      vegMode === 'non-veg'
                        ? 'bg-primary text-white shadow-[0_6px_16px_rgba(122,31,43,0.16)]'
                        : 'text-foreground/70 hover:bg-[hsl(39_50%_97%)] hover:text-foreground',
                    )}
                  >
                    <ToggleDot type="non-veg" active={vegMode === 'non-veg'} />
                    Non Veg
                  </button>
                </div>

                {/* Box cards */}
                {packages.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {packages.map((pkg, i) => {
                      const versionId = pkg.activeVersion?.id ?? '';
                      const chosenPrice = (chosenIdx !== null && chosenIdx !== i && selectedPkg?.activeVersion)
                        ? parseFloat(selectedPkg.activeVersion.basePricePerPlate)
                        : null;
                      return (
                        <BoxCard
                          key={pkg.id}
                          pkg={pkg}
                          index={i}
                          isExpanded={expandedIdx === i}
                          isChosen={chosenIdx === i}
                          config={configs[versionId]}
                          isLoadingConfig={loadingVersionId === versionId}
                          chosenPricePerPlate={chosenPrice}
                          qty={qty}
                          onExpand={() => handleExpand(i)}
                          onChoose={() => handleChoose(i)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">
                      {vegMode === 'non-veg' ? 'Non-Veg boxes coming soon' : 'No boxes available'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Please check back later or try the Veg selection.
                    </p>
                  </div>
                )}

                {/* Bottom features */}
                <div className="grid gap-4 rounded-[22px] border border-[hsl(35_22%_86%)] bg-white p-4 shadow-[0_8px_24px_rgba(45,31,20,0.045)] lg:grid-cols-4">
                  {BOTTOM_FEATURES.map(({ Icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(352_40%_95%)]">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!error && !loading && (
              <div className="lg:hidden">
              <OrderSidebar
                pkg={selectedPkg}
                index={chosenIdx}
                vegMode={vegMode}
                qty={qty}
                onQtyChange={setQty}
                onContinue={handleContinue}
                onEditBox={() => setChosenIdx(null)}
              />
              </div>
            )}
          </div>

          {/* Right: sticky sidebar */}
          <div className="hidden lg:block lg:w-80 xl:w-[340px] shrink-0">
            <div className="sticky top-28">
              <OrderSidebar
                pkg={selectedPkg}
                index={chosenIdx}
                vegMode={vegMode}
                qty={qty}
                onQtyChange={setQty}
                onContinue={handleContinue}
                onEditBox={() => setChosenIdx(null)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      {selectedPkg && (
          <div className="fixed inset-x-0 bottom-[4.75rem] z-30 px-4 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-primary px-5 py-4 shadow-2xl">
            <div>
              <p className="font-bold leading-tight text-white">{selectedDisplayName}</p>
              <p className="text-sm text-white/70">
                {qty} boxes · ₹{(
                  parseFloat(selectedPkg.activeVersion?.basePricePerPlate ?? '0') * qty
                ).toLocaleString('en-IN')}
              </p>
            </div>
            <button
              onClick={handleContinue}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary shadow transition hover:bg-white/90"
            >
              Add to Cart <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
