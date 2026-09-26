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
import { formatCategoryLabel, formatCurrency } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { DataImage } from '../data-image';

function formatPackagePrice(value?: string) {
  if (value == null) return '—';
  return formatCurrency(value).replace(/\.00$/, '');
}

const PACKAGE_HERO_IMAGE_POSITIONS: Record<string, string> = {
  'pkg-puja.png': '50% 48%',
};

function getPackageHeroImagePosition(imageUrl?: string | null) {
  const imageName = imageUrl?.split(/[?#]/, 1)[0]?.split('/').pop();
  return (imageName && PACKAGE_HERO_IMAGE_POSITIONS[imageName]) || '50% 50%';
}

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
  const includedItems = includedByCategory.flatMap(({ items }) => items);
  const isVegetarianPackage =
    includedItems.length > 0 && includedItems.every((item) => item.isVeg);
  const isMealBox = pkg.type === 'MEAL_BOX';
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
          <div className="relative aspect-[2.6/1] min-h-[8rem] overflow-hidden bg-muted sm:aspect-auto sm:h-72">
            <DataImage
              src={pkg.imageUrl}
              alt={`${pkg.name} presentation`}
              className="h-full w-full object-cover"
              style={{ objectPosition: getPackageHeroImagePosition(pkg.imageUrl) }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4 sm:top-4"
              aria-label="Close package details"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/25 shadow-sm backdrop-blur-sm transition-colors hover:bg-black/40">
                <X className="h-4 w-4" />
              </span>
            </button>
            <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-7">
              <h2
                id="package-details-title"
                className="font-sans text-2xl font-semibold leading-tight sm:text-4xl"
              >
                {pkg.name}
              </h2>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-2 sm:gap-7 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              {pkg.description && (
                <p className="text-sm leading-5 text-muted-foreground sm:text-base sm:leading-6">
                  {pkg.description}
                </p>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground lg:hidden">
                <span>
                  {!isMealBox && 'From '}
                  <strong className="money-text text-base font-extrabold text-primary">
                    {formatPackagePrice(version?.basePricePerPlate)}
                  </strong>{' '}
                  / guest
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {version
                    ? version.maxGuestCount
                      ? `${version.minGuestCount}–${version.maxGuestCount} guests`
                      : `${version.minGuestCount}+ guests`
                    : 'Guest range loading'}
                </span>
                {isVegetarianPackage && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{isMealBox ? 'Veg' : 'Vegetarian'}</span>
                  </>
                )}
              </div>
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
                <div className="mt-3 sm:mt-7">
                  <h3 className="font-sans text-lg font-semibold sm:text-2xl">
                    {isMealBox ? "What's in this box" : "What's included"}
                  </h3>
                  <div className="mt-2 space-y-0 sm:mt-3 sm:space-y-5">
                    {includedByCategory.map(({ rule, items }) => (
                      <section key={rule.id}>
                        <div className="mb-0.5 hidden items-center justify-between gap-3 sm:mb-3 sm:flex">
                          <h4 className="category-label sm:text-base">
                            {formatCategoryLabel(rule.category.name)}
                          </h4>
                          {items.length > 1 && (
                            <span className="text-xs font-medium text-muted-foreground">
                              {items.length} items
                            </span>
                          )}
                        </div>
                        <div className="divide-y sm:hidden">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[40px_minmax(0,1fr)_5rem] items-center gap-2 py-1 first:pt-0 last:pb-0"
                            >
                              <div className="h-10 w-10 overflow-hidden rounded-md bg-muted">
                                <DataImage
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <p className="min-w-0 text-sm font-medium leading-5 text-foreground">
                                {item.name}
                              </p>
                              <span className="category-label w-20 self-center pr-1 text-right text-[12px]">
                                {formatCategoryLabel(rule.category.name, {
                                  singular: true,
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="hidden divide-y sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex min-h-10 items-center gap-3 py-0.5 first:pt-0 last:pb-0 sm:grid sm:min-h-0 sm:grid-cols-[72px_1fr] sm:gap-3 sm:rounded-xl sm:border sm:bg-white sm:p-2"
                            >
                              <div className="h-[72px] w-[72px] overflow-hidden rounded-lg bg-muted">
                                <DataImage
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:block sm:py-1">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium leading-5 sm:text-base sm:font-semibold">
                                    {item.name}
                                  </p>
                                </div>
                                {!isVegetarianPackage && (
                                  <span
                                    className={cn(
                                      'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase sm:mt-2 sm:px-2 sm:py-1 sm:text-[10px]',
                                      item.isVeg
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-orange-50 text-orange-700',
                                    )}
                                    aria-label={
                                      item.isVeg ? 'Vegetarian' : 'Non-vegetarian'
                                    }
                                  >
                                    <Leaf className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    {item.isVeg ? 'Veg' : 'Non-veg'}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-7 rounded-2xl border bg-muted/40 p-5">
                  <p className="font-bold">Build this menu your way</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    No dishes are fixed. Choose from the available categories
                    and see item-level pricing while you build.
                  </p>
                </div>
              )}
            </div>

            <aside className="hidden h-fit rounded-2xl border bg-muted/35 p-5 lg:sticky lg:top-5 lg:block">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
                Package essentials
              </p>
              <p className="money-text mt-3 text-3xl font-extrabold text-primary">
                {formatPackagePrice(version?.basePricePerPlate)}
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
                      <span>{swapCount} eligible replacement options</span>
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

        <footer className="shrink-0 border-t bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-7 sm:py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="font-bold">{pkg.name}</p>
              <p className="text-xs text-muted-foreground">
                Review and customize before payment.
              </p>
            </div>
            <Button
              className="h-11 w-full rounded-full px-7 sm:ml-auto sm:w-auto sm:h-12"
              disabled={!config || !version || selecting}
              onClick={onSelect}
            >
              {selecting
                ? 'Selecting…'
                : pkg.isCustom
                  ? 'Build this menu'
                  : isMealBox
                    ? 'Select Meal Box'
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
  onClear,
  onConfirm,
}: {
  currentName: string;
  nextName: string;
  selecting?: boolean;
  onCancel: () => void;
  onClear: () => void;
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
        <h2
          id="change-package-title"
          className="mt-4 font-sans text-2xl font-semibold"
        >
          Add another package?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Keep <strong className="text-foreground">{currentName}</strong> in
          your cart and configure{' '}
          <strong className="text-foreground">{nextName}</strong> separately.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClear}
            disabled={selecting}
            className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Clear cart & continue
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={selecting}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {selecting ? 'Adding…' : 'Add alongside'}
          </button>
        </div>
      </section>
    </div>
  );
}
