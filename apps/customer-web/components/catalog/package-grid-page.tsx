'use client';

import type {
  MenuCategory,
  PackageConfiguration,
  PackageSummary,
  PackageType,
} from '@aranyam/shared-types';
import {
  ArrowRight,
  Check,
  Leaf,
  Package as PackageIcon,
  Plus,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { catalogCopy, packageImage } from '../../lib/catalog-display';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { useSessionStore } from '../../store/session.store';
import { StatePanel } from '../ui/state-panel';

type SelectionIntent = 'select' | 'extras';

export function PackageGridPage({
  type,
  title,
  description,
}: {
  type: PackageType | 'PACKAGES';
  title: string;
  description: string;
}) {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const currentPackage = useOrderBuilderStore((s) => s.package);
  const setPackage = useOrderBuilderStore((s) => s.setPackage);
  const setDbCartId = useOrderBuilderStore((s) => s.setDbCartId);
  const setGuestCount = useOrderBuilderStore((s) => s.setGuestCount);
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [configs, setConfigs] = useState<Record<string, PackageConfiguration>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState('');
  const [error, setError] = useState('');
  const [diet, setDiet] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [pendingPackage, setPendingPackage] = useState<PackageSummary | null>(
    null,
  );
  const [pendingIntent, setPendingIntent] = useState<SelectionIntent>('select');
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const persistence = useSessionStore.persist;
    if (!persistence) {
      setSessionReady(true);
      return;
    }
    if (persistence.hasHydrated()) {
      setSessionReady(true);
      return;
    }
    return persistence.onFinishHydration(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    if (!sessionReady || session) return;
    const returnTo = type === 'MEAL_BOX' ? '/packages/meal-boxes' : '/packages';
    router.replace(
      `/login?reason=catalog&returnTo=${encodeURIComponent(returnTo)}`,
    );
  }, [router, session, sessionReady, type]);

  useEffect(() => {
    if (!sessionReady || !session) return;
    Promise.all([
      apiRequest<PackageSummary[]>('/packages', {}, session.accessToken),
      apiRequest<MenuCategory[]>('/menu/categories', {}, session.accessToken),
    ])
      .then(async ([rows, categoryRows]) => {
        const visible = rows.filter(
          (row) =>
            row.activeVersion &&
            (type === 'PACKAGES' ? row.type !== 'MEAL_BOX' : row.type === type),
        );
        setPackages(visible);
        setCategories(categoryRows);
        const pairs = await Promise.all(
          visible.map(
            async (row) =>
              [
                row.id,
                await apiRequest<PackageConfiguration>(
                  `/package-versions/${row.activeVersion!.id}/configuration`,
                  {},
                  session.accessToken,
                ),
              ] as const,
          ),
        );
        setConfigs(Object.fromEntries(pairs));
      })
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, [session, sessionReady, type]);

  const shown = useMemo(
    () =>
      packages.filter((pkg) => {
        if (type !== 'MEAL_BOX' || diet === 'all') return true;
        const included =
          configs[pkg.id]?.categoryRules.flatMap((rule) =>
            rule.items.filter(
              (item) => item.role === 'INCLUDED' && !item.swapForMenuItemId,
            ),
          ) ?? [];
        return diet === 'veg'
          ? included.every((item) => item.isVeg)
          : included.some((item) => !item.isVeg);
      }),
    [packages, configs, diet, type],
  );

  async function choose(
    pkg: PackageSummary,
    intent: SelectionIntent = 'select',
    confirmed = false,
  ) {
    if (!pkg.activeVersion || selecting) return;
    if (
      currentPackage &&
      currentPackage.packageVersionId !== pkg.activeVersion.id &&
      !confirmed
    ) {
      setPendingPackage(pkg);
      setPendingIntent(intent);
      return;
    }
    setPendingPackage(null);
    setSelecting(pkg.id);
    setError('');
    try {
      const selected = {
        packageId: pkg.id,
        packageVersionId: pkg.activeVersion.id,
        packageName: pkg.name,
        packageType: pkg.type,
        isCustom: pkg.isCustom,
        basePricePerPlate: pkg.activeVersion.basePricePerPlate,
        minGuestCount: pkg.activeVersion.minGuestCount,
        maxGuestCount: pkg.activeVersion.maxGuestCount,
      };
      const cart = session
        ? await apiRequest<{ id: string }>(
            '/cart',
            {
              method: 'PUT',
              body: JSON.stringify({ packageVersionId: pkg.activeVersion.id }),
            },
            session.accessToken,
          )
        : undefined;
      setPackage(selected);
      setDbCartId(cart?.id);
      setGuestCount(pkg.activeVersion.minGuestCount);
      const builder =
        pkg.type === 'CUSTOM_PACKAGE' ? '/menu/visual-builder' : '/menu/select';
      router.push(intent === 'extras' ? `${builder}?focus=extras` : builder);
    } catch (reason) {
      setError((reason as Error).message);
      setSelecting('');
    }
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-background pb-24">
      <section className="border-b bg-primary text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-white/70">
            Choose and continue
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-white/80">{description}</p>
        </div>
      </section>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {type === 'MEAL_BOX' && (
          <div className="mb-6 flex flex-wrap gap-2" aria-label="Diet filter">
            {(['all', 'veg', 'non-veg'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setDiet(value)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${diet === value ? 'bg-primary text-white' : 'border bg-white text-foreground'}`}
              >
                {value === 'all'
                  ? 'All boxes'
                  : value === 'veg'
                    ? 'Veg'
                    : 'Non-Veg'}
              </button>
            ))}
          </div>
        )}
        {error && (
          <div className="mb-6">
            <StatePanel
              tone="danger"
              title="Catalog could not load"
              description={error}
              actionHref={
                type === 'MEAL_BOX' ? '/packages/meal-boxes' : '/packages'
              }
              actionLabel="Retry"
            />
          </div>
        )}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[520px] animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        ) : (
          <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((pkg) => {
              const version = pkg.activeVersion!;
              const config = configs[pkg.id];
              const included =
                config?.categoryRules.flatMap((rule) =>
                  rule.items
                    .filter(
                      (item) =>
                        item.role === 'INCLUDED' && !item.swapForMenuItemId,
                    )
                    .map((item) => ({
                      ...item,
                      categoryName: rule.category.name,
                    })),
                ) ?? [];
              const includedCategoryIds = new Set(
                included.map((item) => item.categoryId),
              );
              const missingCategories =
                pkg.type === 'CUSTOM_PACKAGE'
                  ? categories
                  : categories.filter(
                      (category) => !includedCategoryIds.has(category.id),
                    );
              const isVeg =
                included.length > 0 && included.every((item) => item.isVeg);
              const visibleIncluded = included.slice(0, 6);
              const remainingIncluded = included.slice(6);
              return (
                <article
                  key={pkg.id}
                  data-testid={`package-card-${pkg.id}`}
                  className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:border-primary/30 hover:shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => choose(pkg)}
                    disabled={Boolean(selecting)}
                    className="block w-full text-left disabled:opacity-60"
                  >
                    <div className="relative h-44 overflow-hidden bg-muted/50">
                      <img
                        src={packageImage(pkg.name, pkg.type)}
                        alt={`${pkg.name} presentation`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {pkg.type === 'MEAL_BOX' && (
                        <span
                          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white ${isVeg ? 'bg-emerald-700' : 'bg-red-700'}`}
                        >
                          {isVeg ? 'Veg' : 'Non-Veg'}
                        </span>
                      )}
                    </div>
                    <div className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="font-serif text-2xl font-bold leading-tight">
                            {pkg.name}
                          </h2>
                          <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">
                            {pkg.description}
                          </p>
                        </div>
                        <PackageIcon className="mt-1 h-5 w-5 shrink-0 text-primary" />
                      </div>
                      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-y py-3">
                        <strong className="text-xl text-primary">
                          ₹{version.basePricePerPlate}
                          <span className="text-xs font-normal text-muted-foreground">
                            {' '}
                            / person
                          </span>
                        </strong>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {version.minGuestCount}
                          {version.maxGuestCount
                            ? `–${version.maxGuestCount}`
                            : '+'}{' '}
                          guests
                        </span>
                      </div>
                    </div>
                  </button>
                  <div className="px-5 pb-5">
                    <div className="rounded-xl bg-muted/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
                          Included items
                        </p>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-primary">
                          {included.length}
                        </span>
                      </div>
                      {visibleIncluded.length ? (
                        <ul className="mt-3 space-y-2">
                          {visibleIncluded.map((item) => (
                            <li
                              key={`${item.categoryId}-${item.id}`}
                              className="flex min-w-0 gap-2 text-sm"
                            >
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              <span className="min-w-0">
                                <strong>{item.name}</strong>
                                <span className="text-xs text-muted-foreground">
                                  {' '}
                                  · {item.categoryName} ·{' '}
                                  {item.isVeg ? 'Veg' : 'Non-Veg'}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          No fixed dishes—build this menu from scratch.
                        </p>
                      )}
                      {remainingIncluded.length > 0 && (
                        <details className="mt-3 border-t pt-3">
                          <summary className="cursor-pointer text-sm font-bold text-primary">
                            View {remainingIncluded.length} more included item
                            {remainingIncluded.length === 1 ? '' : 's'}
                          </summary>
                          <ul className="mt-3 space-y-2">
                            {remainingIncluded.map((item) => (
                              <li
                                key={`${item.categoryId}-${item.id}`}
                                className="flex gap-2 text-sm"
                              >
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                <span>
                                  <strong>{item.name}</strong>
                                  <span className="text-xs text-muted-foreground">
                                    {' '}
                                    · {item.categoryName} ·{' '}
                                    {item.isVeg ? 'Veg' : 'Non-Veg'}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    {pkg.type !== 'MEAL_BOX' &&
                      missingCategories.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs text-muted-foreground">
                            Not included:{' '}
                            {missingCategories
                              .slice(0, 4)
                              .map((category) => category.name)
                              .join(', ')}
                            {missingCategories.length > 4
                              ? ` +${missingCategories.length - 4} more`
                              : ''}
                          </p>
                          <button
                            type="button"
                            onClick={() => choose(pkg, 'extras')}
                            disabled={Boolean(selecting)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary hover:bg-primary/5"
                          >
                            <Plus className="h-4 w-4" />
                            {pkg.type === 'CUSTOM_PACKAGE'
                              ? 'Build this menu'
                              : 'Add extras from missing categories'}
                          </button>
                        </div>
                      )}
                    <button
                      type="button"
                      onClick={() => choose(pkg)}
                      disabled={Boolean(selecting)}
                      className="mt-3 flex w-full items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                      {selecting === pkg.id ? 'Selecting…' : 'Select package'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {catalogCopy.packageBenefits.map(([label, sub]) => (
            <div key={label} className="rounded-xl border bg-white p-4">
              <Leaf className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-bold">{label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </section>
      </div>
      {pendingPackage && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-package-title"
        >
          <button
            className="absolute inset-0"
            aria-label="Keep current package"
            onClick={() => setPendingPackage(null)}
          />
          <section className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setPendingPackage(null)}
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
              className="mt-4 font-serif text-2xl font-bold"
            >
              Change your package?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              You’re switching from{' '}
              <strong className="text-foreground">
                {currentPackage?.packageName}
              </strong>{' '}
              to{' '}
              <strong className="text-foreground">{pendingPackage.name}</strong>
              .
            </p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Your current menu selections and event details will be cleared so
              the new package can start with valid choices.
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPendingPackage(null)}
                className="rounded-xl border px-4 py-3 text-sm font-bold text-foreground hover:bg-muted"
              >
                Keep current
              </button>
              <button
                type="button"
                onClick={() => choose(pendingPackage, pendingIntent, true)}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90"
              >
                Change package
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
