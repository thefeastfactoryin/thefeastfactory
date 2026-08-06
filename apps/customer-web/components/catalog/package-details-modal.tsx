'use client';

import type {
  PackageConfiguration,
  PackageSummary,
} from '@aranyam/shared-types';
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  Leaf,
  LockKeyhole,
  Package as PackageIcon,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { DataImage } from '../data-image';

export function PackageDetailsModal({
  pkg,
  config,
  selecting,
  onClose,
  onSelect,
}: {
  pkg: PackageSummary;
  config?: PackageConfiguration;
  selecting?: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const includedByCategory = useMemo(
    () =>
      config?.categoryRules
        .map((rule) => ({
          rule,
          items: rule.items.filter(
            (item) => item.role === 'INCLUDED' && !item.swapForMenuItemId,
          ),
        }))
        .filter(({ items }) => items.length) ?? [],
    [config],
  );
  const swapCount =
    config?.categoryRules.reduce(
      (total, rule) =>
        total + rule.items.filter((item) => item.swapForMenuItemId).length,
      0,
    ) ?? 0;
  const extraCount =
    config?.categoryRules.reduce(
      (total, rule) =>
        total + rule.items.filter((item) => item.role === 'EXTRA').length,
      0,
    ) ?? 0;
  const version = pkg.activeVersion;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-details-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close package details"
        onClick={onClose}
      />
      <section className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-3xl">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative h-56 overflow-hidden bg-muted sm:h-72">
            <DataImage
              src={pkg.imageUrl}
              alt={`${pkg.name} presentation`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur hover:bg-black/45"
              aria-label="Close package details"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
              <span className="inline-flex rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] backdrop-blur">
                {pkg.type === 'MEAL_BOX'
                  ? 'Meal box'
                  : pkg.isCustom
                    ? 'Build your own'
                    : 'Curated package'}
              </span>
              <h2
                id="package-details-title"
                className="mt-3 font-serif text-3xl font-bold sm:text-4xl"
              >
                {pkg.name}
              </h2>
            </div>
          </div>

          <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              {pkg.description && (
                <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                  {pkg.description}
                </p>
              )}

              {!config ? (
                <div className="mt-6 space-y-3">
                  {[1, 2, 3].map((row) => (
                    <div
                      key={row}
                      className="h-24 animate-pulse rounded-2xl bg-muted"
                    />
                  ))}
                </div>
              ) : includedByCategory.length ? (
                <div className="mt-7 space-y-7">
                  <div>
                    <p className="eyebrow">What is included</p>
                    <h3 className="mt-2 font-serif text-2xl font-bold">
                      Your package menu
                    </h3>
                  </div>
                  {includedByCategory.map(({ rule, items }) => (
                    <section key={rule.id}>
                      <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2">
                        <h4 className="font-bold">{rule.category.name}</h4>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {items.length} {items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-[72px_1fr] gap-3 rounded-xl border bg-white p-2"
                          >
                            <div className="h-[72px] overflow-hidden rounded-lg bg-muted">
                              <DataImage
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 py-1">
                              <p className="font-semibold leading-5">{item.name}</p>
                              <span
                                className={cn(
                                  'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase',
                                  item.isVeg
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-orange-50 text-orange-700',
                                )}
                              >
                                <Leaf className="h-3 w-3" />
                                {item.isVeg ? 'Veg' : 'Non-veg'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="mt-7 rounded-2xl border bg-muted/40 p-5">
                  <p className="font-bold">Build this menu your way</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    No dishes are locked in. Choose from the available categories
                    and see item-level pricing while you build.
                  </p>
                </div>
              )}
            </div>

            <aside className="h-fit rounded-2xl border bg-muted/35 p-5 lg:sticky lg:top-5">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
                Package essentials
              </p>
              <p className="mt-3 text-3xl font-extrabold text-primary">
                {version ? `₹${version.basePricePerPlate}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">per person</p>
              <div className="my-4 h-px bg-border" />
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>
                  {version
                    ? version.maxGuestCount
                      ? `${version.minGuestCount}–${version.maxGuestCount} guests`
                      : `${version.minGuestCount}+ guests`
                    : 'Guest range loading'}
                </span>
              </div>
              {config && (
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{config.categoryRules.length} menu categories</span>
                  </div>
                  {config.packageType === 'FIXED_PACKAGE' && (
                    <div className="flex items-start gap-2">
                      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Included dishes stay fixed</span>
                    </div>
                  )}
                  {swapCount > 0 && (
                    <div className="flex items-start gap-2">
                      <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{swapCount} eligible swap options</span>
                    </div>
                  )}
                  {extraCount > 0 && (
                    <div className="flex items-start gap-2">
                      <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{extraCount} optional extras</span>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>

        <footer className="shrink-0 border-t bg-white/95 p-4 backdrop-blur sm:px-7">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="font-bold">{pkg.name}</p>
              <p className="text-xs text-muted-foreground">
                Review and customize before payment.
              </p>
            </div>
            <Button
              className="h-12 w-full rounded-full px-7 sm:ml-auto sm:w-auto"
              disabled={!config || !version || selecting}
              onClick={onSelect}
            >
              {selecting
                ? 'Selecting…'
                : pkg.isCustom
                  ? 'Build this menu'
                  : 'Select package'}
              {!selecting && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function PackageChangeDialog({
  currentName,
  nextName,
  selecting,
  onCancel,
  onConfirm,
}: {
  currentName: string;
  nextName: string;
  selecting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="change-package-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Keep current package"
        onClick={onCancel}
      />
      <section className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <PackageIcon className="h-5 w-5" />
        </span>
        <h2 id="change-package-title" className="mt-4 font-serif text-2xl font-bold">
          Add another package?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Keep <strong className="text-foreground">{currentName}</strong> in
          your cart and configure{' '}
          <strong className="text-foreground">{nextName}</strong> separately.
        </p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          The current package stays in your cart. The editor will switch to the
          new package so it can have its own count and menu selections.
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border px-4 py-3 text-sm font-bold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={selecting}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {selecting ? 'Adding…' : 'Add package'}
          </button>
        </div>
      </section>
    </div>
  );
}
