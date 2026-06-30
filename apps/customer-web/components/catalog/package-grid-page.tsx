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
  Clock,
  CreditCard,
  Package as PackageIcon,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { packageImage } from '../../lib/catalog-display';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { useSessionStore } from '../../store/session.store';
import { StatePanel } from '../ui/state-panel';
import { Advantages } from '../home/advantages';
import {
  PackageChangeDialog,
  PackageDetailsModal,
} from './package-details-modal';

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const detailsId = searchParams.get('details');
  const detailsPackage = packages.find((pkg) => pkg.id === detailsId);

  function updateDetails(packageId?: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (packageId) next.set('details', packageId);
    else next.delete('details');
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

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

  const titleParts = title.split(' ');
  const titleAccent = titleParts.pop() ?? title;
  const titleLead = titleParts.join(' ');
  const heroTrust = [
    { Icon: ShieldCheck, label: 'Freshly prepared' },
    { Icon: Clock, label: 'On-time delivery' },
    { Icon: CreditCard, label: 'Transparent pricing' },
    {
      Icon: Users,
      label:
        type === 'MEAL_BOX' ? 'Group-ready boxes' : 'Menus for every gathering',
    },
  ];

  return (
    <main className="min-h-screen overflow-x-clip bg-background">
      <section className="relative isolate overflow-hidden border-b bg-hero-end text-white">
        <img
          src={
            type === 'MEAL_BOX'
              ? '/order-mealbox.png'
              : '/packages-hero-food.png'
          }
          alt=""
          className={`absolute inset-0 -z-20 h-full w-full ${type === 'MEAL_BOX' ? 'object-cover opacity-50' : 'object-cover object-center'}`}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--hero-end)/0.96)_0%,hsl(var(--hero-start)/0.82)_42%,hsl(var(--hero-start)/0.30)_72%,rgba(0,0,0,0.08)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_30%,hsl(var(--accent)/0.14),transparent_30%)]" />
        <div className="container-pad py-10 sm:py-12 lg:py-14">
          <div className="max-w-2xl">
            <p className="eyebrow">
              {type === 'MEAL_BOX'
                ? 'Packed meals for groups'
                : 'Premium bulk catering'}
            </p>
            <h1 className="mt-3 font-serif text-5xl font-bold leading-[0.96] tracking-tight sm:text-6xl lg:text-7xl">
              {titleLead && <span>{titleLead} </span>}
              <span className="text-accent">{titleAccent}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-7 text-white/85 sm:text-lg">
              {description}
            </p>
            <div className="mt-6 grid max-w-3xl gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {heroTrust.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-bold leading-tight text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] backdrop-blur-sm"
                >
                  <Icon
                    className="h-4 w-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  {label}
                </div>
              ))}
            </div>
          </div>
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
                    onClick={() => updateDetails(pkg.id)}
                    className="block w-full text-left"
                    aria-label={`View details for ${pkg.name}`}
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
                      <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary">
                        View package details <ArrowRight className="h-4 w-4" />
                      </span>
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
      </div>
      <Advantages />
      {!loading && detailsId && !detailsPackage && (
        <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-lg">
          This package is unavailable in this catalog.{' '}
          <button
            type="button"
            onClick={() => updateDetails()}
            className="font-bold underline"
          >
            Close
          </button>
        </div>
      )}
      {detailsPackage && (
        <PackageDetailsModal
          pkg={detailsPackage}
          config={configs[detailsPackage.id]}
          selecting={selecting === detailsPackage.id}
          onClose={() => updateDetails()}
          onSelect={() => choose(detailsPackage)}
        />
      )}
      {pendingPackage && (
        <PackageChangeDialog
          currentName={currentPackage?.packageName ?? 'your current package'}
          nextName={pendingPackage.name}
          selecting={selecting === pendingPackage.id}
          onCancel={() => setPendingPackage(null)}
          onConfirm={() => choose(pendingPackage, pendingIntent, true)}
        />
      )}
    </main>
  );
}
