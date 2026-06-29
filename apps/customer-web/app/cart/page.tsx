'use client';

import type { PackageConfiguration } from '@aranyam/shared-types';
import {
  ArrowRight,
  CalendarDays,
  Leaf,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { OrderProgress } from '../../components/order-progress';
import { Button } from '../../components/ui/button';
import { apiRequest } from '../../lib/api';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { cn } from '../../lib/utils';

export default function CartPage() {
  const cartPackage = useOrderBuilderStore((s) => s.package);
  const event = useOrderBuilderStore((s) => s.event);
  const guestCount = useOrderBuilderStore((s) => s.guestCount);
  const setGuestCount = useOrderBuilderStore((s) => s.setGuestCount);
  const selectedItems = useOrderBuilderStore((s) => s.selectedItems);
  const removeItem = useOrderBuilderStore((s) => s.removeItem);
  const reset = useOrderBuilderStore((s) => s.reset);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (cartPackage?.packageVersionId) {
      apiRequest<PackageConfiguration>(
        `/package-versions/${cartPackage.packageVersionId}/configuration`,
      )
        .then(setConfig)
        .catch(() => undefined);
    }
  }, [cartPackage?.packageVersionId]);

  const selectionStatus = useMemo(() => {
    if (!config) return { valid: false, missing: [] as string[] };
    if (config.isCustom)
      return { valid: selectedItems.length > 0, missing: selectedItems.length ? [] : ['at least one dish'] };
    const missing = config.categoryRules
      .filter((rule) => {
        const count = selectedItems.filter((i) => i.categoryId === rule.category.id).length;
        return count < rule.minSelections || count > rule.maxSelections;
      })
      .map((r) => r.category.name);
    return { valid: missing.length === 0, missing };
  }, [config, selectedItems]);

  if (!mounted)
    return (
      <main className="page-shell">
        <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      </main>
    );

  if (!cartPackage)
    return (
      <main className="page-shell">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBag className="h-7 w-7" />
          </span>
          <h1 className="mt-6 text-2xl font-extrabold">Your cart is empty</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Start with a catering package, add event details, and build your menu.
          </p>
          <Button asChild className="mt-7 rounded-full">
            <Link href="/packages">Browse packages</Link>
          </Button>
        </div>
      </main>
    );

  const additions = selectedItems.reduce((t, i) => t + Number(i.adjustmentAmount), 0);
  const finalPerPlate = Number(cartPackage.basePricePerPlate) + additions;
  const estimate = finalPerPlate * guestCount;
  const minGuests = cartPackage.minGuestCount ?? 1;
  const maxGuests = cartPackage.maxGuestCount ?? 1000;

  const nextHref = !event
    ? `/events/new?packageVersionId=${cartPackage.packageVersionId}`
    : !selectionStatus.valid ? '/menu/select' : '/checkout';
  const nextLabel = !event ? 'Add event details'
    : !selectionStatus.valid ? 'Complete menu selection'
      : 'Continue to checkout';

  const grouped = selectedItems.reduce<Record<string, typeof selectedItems>>(
    (acc, item) => {
      acc[item.categoryName] = [...(acc[item.categoryName] ?? []), item];
      return acc;
    },
    {},
  );

  return (
    <main className="pb-28">
      {/* ── Header ── */}
      <div className="bg-primary">
        <div className="container-pad py-8">
          <div className="mb-6">
            <OrderProgress current={!event ? 1 : !selectionStatus.valid ? 2 : 3} />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow text-accent">Order review</p>
              <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Review your order
              </h1>
            </div>
            <button
              onClick={reset}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white/80 transition-colors hover:bg-white/15 sm:justify-start"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          </div>
        </div>
      </div>

      <div className="container-pad py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ── Details ── */}
          <div className="space-y-4">
            {/* Package card */}
            <section className="surface-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Package</p>
                  <h2 className="mt-1.5 text-xl font-extrabold">{cartPackage.packageName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {cartPackage.isCustom
                      ? 'Priced from selected dish base prices'
                      : `₹${cartPackage.basePricePerPlate} base price per guest`}
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full shrink-0 rounded-full text-sm sm:w-auto">
                  <Link href="/packages">Change</Link>
                </Button>
              </div>
            </section>

            {/* Event card */}
            <section className="surface-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Event details</p>
                  <h2 className="mt-1.5 text-xl font-extrabold">
                    {event?.eventName || 'No event added yet'}
                  </h2>
                </div>
                <Button asChild variant="outline" className="w-full shrink-0 rounded-full text-sm sm:w-auto">
                  <Link href={`/events/new?packageVersionId=${cartPackage.packageVersionId}`}>
                    {event ? 'Edit' : 'Add'}
                  </Link>
                </Button>
              </div>
              {event ? (
                <div className="mt-4 grid gap-2.5 text-sm text-muted-foreground lg:grid-cols-3">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                    {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-primary" />
                    {guestCount} guests
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    {event.addressLabel}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-amber-700">
                  Add a date, venue, and guest count to continue.
                </p>
              )}
            </section>

            {/* Selected dishes */}
            <section className="surface-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Selected dishes</p>
                <Button asChild variant="outline" className="h-8 rounded-full px-4 text-xs">
                  <Link href="/menu/select">Edit menu</Link>
                </Button>
              </div>
              {Object.keys(grouped).length > 0 ? (
                <div className="divide-y divide-border">
                  {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="px-6 py-4">
                      <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                        {category}
                      </p>
                      <div className="space-y-2.5">
                        {items.map((item) => (
                          <div key={item.menuItemId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', item.isVeg ? 'bg-emerald-500' : 'bg-orange-500')} />
                              <p className="min-w-0 text-sm font-semibold leading-5">{item.menuItemName}</p>
                            </div>
                            <div className="flex shrink-0 items-center justify-between gap-3 pl-4 sm:justify-start sm:pl-0">
                              <span className="text-sm text-muted-foreground">
                                {cartPackage.isCustom
                                  ? `₹${item.itemPrice}`
                                  : Number(item.adjustmentAmount) > 0
                                    ? `+₹${item.adjustmentAmount}`
                                    : 'Included'}
                              </span>
                              <button
                                onClick={() => removeItem(item.menuItemId)}
                                className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove ${item.menuItemName}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <Leaf className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold">No dishes selected yet.</p>
                  <Button asChild variant="outline" className="mt-4 rounded-full">
                    <Link href="/menu/select">Build your menu</Link>
                  </Button>
                </div>
              )}
            </section>

            {selectionStatus.missing.length > 0 && (
              <div className="rounded-xl bg-amber-50 px-5 py-4 text-sm">
                <p className="font-extrabold text-amber-900">Complete these before checkout:</p>
                <ul className="mt-2 list-disc pl-4 text-amber-800">
                  {selectionStatus.missing.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* ── Summary sidebar ── */}
          <aside>
            <div className="surface-card lg:sticky lg:top-20">
              {/* Guest count — prominent */}
              <div className="border-b border-border p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Guest count</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="qty-row">
                    <button className="qty-btn" onClick={() => setGuestCount(Math.max(minGuests, guestCount - 1))} aria-label="Decrease">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="qty-val">{guestCount}</span>
                    <button className="qty-btn" onClick={() => setGuestCount(Math.min(maxGuests, guestCount + 1))} aria-label="Increase">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">min {minGuests} · max {maxGuests}</span>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Pricing summary</p>
                <div className="mt-4 space-y-2.5 text-sm">
                  {!cartPackage.isCustom && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base price</span>
                      <span className="font-semibold">₹{cartPackage.basePricePerPlate}/plate</span>
                    </div>
                  )}
                  {additions > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Premium additions</span>
                      <span className="font-semibold text-accent">+₹{additions.toFixed(2)}/plate</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">Per plate</span>
                    <span>₹{finalPerPlate.toFixed(2)}</span>
                  </div>
                </div>

                {/* Formula */}
                <div className="mt-4 rounded-xl border border-primary/10 bg-primary/5 p-4">
                  <p className="text-xs text-muted-foreground">Estimated total</p>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    ₹{finalPerPlate.toFixed(0)} × {guestCount} guests
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-primary">₹{estimate.toFixed(0)}</p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Final total confirmed at checkout after delivery fee is added.
                </p>

                <Button asChild className="mt-5 w-full rounded-full">
                  <Link href={nextHref}>
                    {nextLabel} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
