'use client';

import type {
  CartSummary,
  MenuCategory,
  PackageConfiguration,
  PackageSummary,
  PackageType,
} from '@aranyam/shared-types';
import {
  ArrowRight,
  ChefHat,
  Check,
  Clock3,
  IndianRupee,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useDeliveryLocationStore } from '../../store/delivery-location.store';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { useSessionStore } from '../../store/session.store';
import { StatePanel } from '../ui/state-panel';
import { Advantages } from '../home/advantages';
import { DataImage } from '../data-image';
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
  const deliveryLocation = useDeliveryLocationStore((s) => s.location);
  const currentPackage = useOrderBuilderStore((s) => s.package);
  const setPackage = useOrderBuilderStore((s) => s.setPackage);
  const setDbCartId = useOrderBuilderStore((s) => s.setDbCartId);
  const setGuestCount = useOrderBuilderStore((s) => s.setGuestCount);
  const reset = useOrderBuilderStore((s) => s.reset);
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
  const [activeCartCount, setActiveCartCount] = useState(0);

  useEffect(() => {
    Promise.all([
      apiRequest<PackageSummary[]>('/packages'),
      apiRequest<MenuCategory[]>('/menu/categories'),
    ])
      .then(async ([rows, categoryRows]) => {
        const requestedType = searchParams.get('type');
        const visible = rows.filter(
          (row) =>
            row.activeVersion &&
            (type === 'PACKAGES'
              ? requestedType === 'CUSTOM_PACKAGE'
                ? row.type === 'CUSTOM_PACKAGE'
                : row.type !== 'MEAL_BOX'
              : row.type === type),
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
                ),
              ] as const,
          ),
        );
        setConfigs(Object.fromEntries(pairs));
      })
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, [type, searchParams]);

  useEffect(() => {
    if (!session) {
      setActiveCartCount(0);
      return;
    }
    apiRequest<CartSummary[]>('/cart/all', {}, session.accessToken)
      .then((rows) => setActiveCartCount(rows.length))
      .catch(() => setActiveCartCount(0));
  }, [session]);

  const shown = useMemo(() => {
    const visible = packages.filter((pkg) => {
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
    });

    if (type !== 'MEAL_BOX' || diet !== 'all') return visible;

    return visible.sort((first, second) => {
      const firstIncluded =
        configs[first.id]?.categoryRules.flatMap((rule) =>
          rule.items.filter(
            (item) => item.role === 'INCLUDED' && !item.swapForMenuItemId,
          ),
        ) ?? [];
      const secondIncluded =
        configs[second.id]?.categoryRules.flatMap((rule) =>
          rule.items.filter(
            (item) => item.role === 'INCLUDED' && !item.swapForMenuItemId,
          ),
        ) ?? [];
      const firstIsVeg =
        firstIncluded.length > 0 && firstIncluded.every((item) => item.isVeg);
      const secondIsVeg =
        secondIncluded.length > 0 && secondIncluded.every((item) => item.isVeg);

      return Number(secondIsVeg) - Number(firstIsVeg);
    });
  }, [packages, configs, diet, type]);
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
    const hasExistingCart = session
      ? activeCartCount > 0
      : Boolean(currentPackage);
    if (hasExistingCart && !confirmed) {
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
              method: 'POST',
              body: JSON.stringify({
                packageVersionId: pkg.activeVersion.id,
                guestCount: pkg.activeVersion.minGuestCount,
                ...(deliveryLocation?.resolution.serviceable &&
                deliveryLocation.resolution.region
                  ? { regionId: deliveryLocation.resolution.region.id }
                  : {}),
              }),
            },
            session.accessToken,
          )
        : undefined;
      setPackage(selected);
      setDbCartId(cart?.id);
      setGuestCount(pkg.activeVersion.minGuestCount);
      setActiveCartCount((count) => count + 1);
      const builder =
        pkg.type === 'CUSTOM_PACKAGE' ? '/packages/build' : '/menu/select';
      const next = new URLSearchParams({
        packageVersionId: pkg.activeVersion.id,
      });
      if (cart?.id) next.set('cartId', cart.id);
      if (intent === 'extras') next.set('focus', 'extras');
      router.push(`${builder}?${next.toString()}`);
    } catch (reason) {
      setError((reason as Error).message);
      setSelecting('');
    }
  }

  async function clearCartAndChoose(
    pkg: PackageSummary,
    intent: SelectionIntent,
  ) {
    if (session) {
      await apiRequest('/cart', { method: 'DELETE' }, session.accessToken);
    }
    reset();
    setActiveCartCount(0);
    await choose(pkg, intent, true);
  }

  const titleParts = title.split(' ');
  const titleAccent = titleParts.pop() ?? title;
  const titleLead = titleParts.join(' ');
  const isMealBox = type === 'MEAL_BOX';
  const heroTitleLead = isMealBox ? titleLead : 'Occasion';
  const heroTitleAccent = isMealBox ? titleAccent : 'Packages';
  const heroDescription = isMealBox
    ? description
    : 'Curated catering menus for family celebrations, gatherings, and events.';
  const heroTrust = [
    ...(isMealBox
      ? [
          { Icon: ShieldCheck, label: 'Freshly prepared' },
          { Icon: Clock3, label: 'On-time delivery' },
          { Icon: IndianRupee, label: 'Transparent pricing' },
          { Icon: Users, label: 'Group-ready boxes' },
        ]
      : [
          { Icon: ChefHat, label: 'Freshly Prepared on the Day' },
          { Icon: ShieldCheck, label: 'Hygienic Kitchen Practices' },
          { Icon: Clock3, label: 'On-Time Delivery' },
          { Icon: IndianRupee, label: 'Transparent Pricing' },
        ]),
  ];
  return (
    <main className="min-h-screen overflow-x-clip bg-background [font-family:var(--font-package-sans),sans-serif]">
      <section className="relative isolate overflow-hidden border-b bg-hero-end text-white">
        <img
          src={isMealBox ? '/order-mealbox.png' : '/packages-hero-plated.png'}
          alt={
            isMealBox
              ? 'An opened, individually portioned meal box'
              : 'A curated menu of four plated dishes'
          }
          className={`absolute inset-0 -z-20 h-full w-full object-cover ${
            isMealBox ? 'object-[62%_center]' : 'object-center'
          }`}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--hero-end)/0.99)_0%,hsl(var(--hero-start)/0.94)_40%,hsl(var(--hero-start)/0.30)_72%,rgba(0,0,0,0.08)_100%)]" />
        <div className="container-pad flex min-h-[238px] items-center py-5 sm:min-h-[330px] sm:py-7 lg:min-h-[360px] lg:px-16 lg:py-9">
          <div className="max-w-[620px]">
            <p className="eyebrow">
              {isMealBox ? 'Packed meals for groups' : 'Premium Bulk Catering'}
            </p>
            <h1 className="mt-2 font-serif text-[36px] font-bold leading-[0.95] tracking-tight text-white sm:text-[54px] lg:text-[64px]">
              {heroTitleLead && <span>{heroTitleLead} </span>}
              <span className="text-accent">{heroTitleAccent}</span>
            </h1>
            <p className="mt-3 hidden max-w-[520px] text-base font-semibold leading-6 text-white/85 sm:block sm:text-lg">
              {heroDescription}
            </p>
            <div className="mt-4 grid max-w-[600px] grid-cols-2 gap-1.5 sm:mt-5 sm:grid-cols-4 sm:gap-2">
              {heroTrust.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-2.5 py-1.5 text-white backdrop-blur-sm sm:min-h-11 sm:py-2"
                >
                  <Icon
                    className="h-[18px] w-[18px] shrink-0 text-accent"
                    aria-hidden="true"
                    strokeWidth={2}
                  />
                  <span className="text-[11px] font-extrabold leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto w-full max-w-7xl px-4 pb-2 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7">
        <div className="mb-5 hidden text-center sm:block">
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 rounded-full bg-accent/45" />
            <h2 className="text-2xl font-bold leading-tight text-foreground [font-family:var(--font-package-heading),serif] sm:text-3xl">
              {isMealBox
                ? 'Choose the right box for your group'
                : 'Find the right menu for your celebration'}
            </h2>
            <span className="h-px w-8 rounded-full bg-accent/45" />
          </div>
        </div>
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
          <div
            className={`grid gap-5 sm:grid-cols-2 ${
              isMealBox ? 'xl:grid-cols-3' : 'lg:grid-cols-4'
            }`}
          >
            {(isMealBox ? [1, 2, 3] : [1, 2, 3, 4]).map((item) => (
              <div
                key={item}
                className="h-[520px] animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        ) : (
          <div
            className={`grid items-stretch gap-4 sm:grid-cols-2 ${
              isMealBox ? 'xl:grid-cols-3' : 'lg:grid-cols-4'
            }`}
          >
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
              const categoryHighlights = (config?.categoryRules ?? []).flatMap(
                (rule) => {
                  const count = rule.items.filter(
                    (item) =>
                      item.role === 'INCLUDED' && !item.swapForMenuItemId,
                  ).length;
                  return count
                    ? [{ categoryName: rule.category.name, count }]
                    : [];
                },
              );
              return (
                <article
                  key={pkg.id}
                  data-testid={`package-card-${pkg.id}`}
                  className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-border bg-card shadow-card transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-card-hover"
                >
                  <button
                    type="button"
                    onClick={() => updateDetails(pkg.id)}
                    className="block w-full text-left"
                    aria-label={`View details for ${pkg.name}`}
                  >
                    <div className="relative h-[160px] shrink-0 overflow-hidden bg-muted/50 sm:h-[168px]">
                      <DataImage
                        src={pkg.imageUrl}
                        alt={`${pkg.name} presentation`}
                        className="h-full w-full object-cover transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.045]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-80" />
                      {pkg.type === 'MEAL_BOX' && (
                        <span
                          className={`absolute right-4 top-4 rounded-full border border-white/25 px-3 py-1 text-xs font-bold text-white shadow-sm ${isVeg ? 'bg-emerald-700/90' : 'bg-red-700/90'}`}
                        >
                          {isVeg ? 'Veg' : 'Non-Veg'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col bg-white px-4 pb-3 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-[20px] font-bold leading-[1.12] text-foreground [font-family:var(--font-package-heading),serif]">
                            {pkg.name}
                          </h2>
                          <p className="mt-1.5 hidden line-clamp-2 min-h-[38px] text-[13px] leading-[1.42] text-muted-foreground sm:block">
                            {pkg.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[14px] border border-border bg-ivory">
                        <div className="border-r border-border px-3 py-2">
                          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                            From
                          </p>
                          <strong className="mt-0.5 block text-[18px] font-bold leading-none text-primary [font-family:Manrope,serif]">
                            &#8377;{version.basePricePerPlate}
                          </strong>
                          <p className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">
                            per guest
                          </p>
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                            Serves
                          </p>
                          <span className="mt-0.5 block text-[13px] font-extrabold leading-snug text-foreground">
                            {version.minGuestCount}
                            {version.maxGuestCount
                              ? `-${version.maxGuestCount}`
                              : '+'}{' '}
                            guests
                          </span>
                        </div>
                      </div>
                      <span className="mt-2 hidden w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-extrabold text-emerald-800 ring-1 ring-inset ring-emerald-200 sm:inline-flex">
                        Includes packaging
                      </span>
                      <div className="hidden">
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
                      <span className="hidden">
                        View package details <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                  <div className="mt-auto px-4 pb-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-extrabold text-charcoal">
                        <p>Highlights</p>
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                          {pkg.isCustom
                            ? 'Custom menu selection'
                            : `${Math.max(included.length, visibleIncluded.length)} menu highlights`}
                        </span>
                      </div>
                      {categoryHighlights.length ? (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {categoryHighlights.map(({ categoryName, count }) => (
                            <span
                              key={categoryName}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-ivory px-2.5 py-1 text-[11px] font-semibold leading-4 text-foreground/85"
                            >
                              <Check
                                className="h-3 w-3 shrink-0 text-primary"
                                strokeWidth={2.4}
                                aria-hidden="true"
                              />
                              {count} {categoryName}
                            </span>
                          ))}
                        </div>
                      ) : visibleIncluded.length ? (
                        <ul className="mb-4 space-y-1.5">
                          {visibleIncluded.slice(0, 4).map((item) => (
                            <li
                              key={`${item.categoryId}-${item.id}`}
                              className="flex min-w-0 items-center gap-2.5 text-[13px] leading-[1.25] text-foreground/85"
                            >
                              <Check
                                className="h-[15px] w-[15px] shrink-0 text-primary"
                                strokeWidth={2.6}
                              />
                              <span className="min-w-0 truncate">
                                <strong className="font-normal">
                                  {item.name}
                                </strong>
                                <span className="hidden">
                                  {' '}
                                  · {item.categoryName} ·{' '}
                                  {item.isVeg ? 'Veg' : 'Non-Veg'}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <ul className="mb-4 space-y-1.5">
                          {[
                            'Choose any items',
                            'Customise portions',
                            'Add / remove items',
                            'Perfect for any occasion',
                          ].map((item) => (
                            <li
                              key={item}
                              className="flex min-w-0 items-center gap-2.5 text-[13px] leading-[1.25] text-foreground/85"
                            >
                              <Check
                                className="h-[15px] w-[15px] shrink-0 text-primary"
                                strokeWidth={2.6}
                              />
                              <span className="min-w-0 truncate">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {isMealBox &&
                        categoryHighlights.length === 0 &&
                        remainingIncluded.length > 0 && (
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
                                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
                    {isMealBox &&
                      pkg.type !== 'MEAL_BOX' &&
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
                      onClick={() => updateDetails(pkg.id)}
                      className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-primary/45 bg-white px-4 text-[13px] font-extrabold text-primary shadow-[0_7px_15px_rgba(116,28,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/[0.035]"
                    >
                      View menu
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => choose(pkg)}
                      disabled={Boolean(selecting)}
                      className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13.5px] font-extrabold text-white shadow-[0_7px_15px_rgba(116,28,42,0.12)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60"
                    >
                      {selecting === pkg.id
                        ? 'Selecting...'
                        : pkg.type === 'CUSTOM_PACKAGE'
                          ? 'Build menu'
                          : pkg.type === 'MEAL_BOX'
                            ? 'Select Meal Box'
                            : 'Select Package'}
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
          onClear={() => void clearCartAndChoose(pendingPackage, pendingIntent)}
          onConfirm={() => choose(pendingPackage, pendingIntent, true)}
        />
      )}
    </main>
  );
}
