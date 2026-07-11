'use client';

import type {
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
  Package as PackageIcon,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
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
  useEffect(() => {
    Promise.all([
      apiRequest<PackageSummary[]>('/packages'),
      apiRequest<MenuCategory[]>('/menu/categories'),
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
                ),
              ] as const,
          ),
        );
        setConfigs(Object.fromEntries(pairs));
      })
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, [type]);

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
      setDbCartId(cart?.id, session?.user.id);
      setGuestCount(pkg.activeVersion.minGuestCount);
      const builder =
        pkg.type === 'CUSTOM_PACKAGE' ? '/packages/build' : '/menu/select';
      const next = new URLSearchParams({
        packageVersionId: pkg.activeVersion.id,
      });
      if (intent === 'extras') next.set('focus', 'extras');
      router.push(`${builder}?${next.toString()}`);
    } catch (reason) {
      setError((reason as Error).message);
      setSelecting('');
    }
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
  const trustStrip = [
    {
      Icon: Users,
      label:
        type === 'MEAL_BOX'
          ? 'Packed for offices and groups'
          : 'Trusted for family celebrations',
    },
    { Icon: PackageIcon, label: 'Freshly cooked for every order' },
    { Icon: ShieldCheck, label: 'Support from enquiry to delivery' },
    {
      Icon: Users,
      label: isMealBox ? 'Boxes for 20+ guests' : 'Menus for 20-1000 guests',
    },
  ];

  return (
    <main className="min-h-screen overflow-x-clip bg-background [font-family:var(--font-package-sans),sans-serif]">
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
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--hero-end)/0.99)_0%,hsl(var(--hero-start)/0.88)_42%,hsl(var(--hero-start)/0.38)_72%,rgba(0,0,0,0.16)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_30%,hsl(var(--accent)/0.10),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.06)_0%,hsl(var(--hero-end)/0.18)_100%)]" />
        <div className="container-pad pb-6 pt-10 sm:pt-12 lg:pb-8 lg:pl-16 lg:pt-14">
          <div className="max-w-[560px]">
            <p className="eyebrow">
              {isMealBox ? 'Packed meals for groups' : 'Premium Bulk Catering'}
            </p>
            <h1 className="mt-3 font-serif text-[40px] font-bold leading-[0.95] tracking-tight text-white sm:text-[56px] lg:text-[86px]">
              {heroTitleLead && <span>{heroTitleLead} </span>}
              <span className="block text-accent">{heroTitleAccent}</span>
            </h1>
            <p className="mt-4 max-w-[470px] text-base font-semibold leading-7 text-white/85 sm:text-lg lg:text-xl">
              {heroDescription}
            </p>
            <div className="mt-6 grid max-w-[560px] gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {heroTrust.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex min-h-12 items-center gap-2.5 rounded-[18px] border border-white/10 bg-black/10 px-3 py-2 text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] backdrop-blur-sm"
                >
                  <Icon
                    className="h-[19px] w-[19px] shrink-0 text-accent"
                    aria-hidden="true"
                    strokeWidth={2}
                  />
                  <span className="text-[12.5px] font-extrabold leading-[1.15]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 max-w-[840px] rounded-br-[22px] rounded-tr-[22px] border border-[hsl(35_24%_84%)] bg-[hsl(39_50%_97%)] px-4 py-[18px] text-foreground shadow-[0_14px_34px_rgba(33,18,12,0.13)] sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trustStrip.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 text-[13px] font-bold leading-snug"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-[hsl(37_38%_92%)] text-[hsl(31_28%_43%)]">
                    <Icon className="h-5 w-5" strokeWidth={2.15} />
                  </span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto w-full max-w-7xl px-4 pb-2 pt-6 sm:px-6 lg:px-8 lg:pt-7">
        <div className="mb-5 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 rounded-full bg-accent/45" />
            <h2 className="text-2xl font-bold leading-tight text-foreground [font-family:var(--font-package-heading),serif] sm:text-3xl">
              {isMealBox
                ? 'Choose the right box for your group'
                : 'Find the right menu for your celebration'}
            </h2>
            <span className="h-px w-8 rounded-full bg-accent/45" />
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            {isMealBox
              ? 'Explore neatly packed meal boxes with clear portions, reliable delivery, and menu choices for groups.'
              : 'Explore curated packages for poojas, birthdays, corporate meals, house gatherings, and large events.'}
          </p>
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
            className={`grid items-start gap-4 sm:grid-cols-2 ${
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
              return (
                <article
                  key={pkg.id}
                  data-testid={`package-card-${pkg.id}`}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[hsl(35_22%_86%)] bg-white shadow-[0_7px_20px_rgba(45,31,20,0.045)] transition-all duration-[250ms] [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:border-[hsla(41,56%,52%,0.42)] hover:shadow-[0_14px_30px_rgba(45,31,20,0.075)]"
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
                      <span className="absolute -bottom-5 left-4 grid h-10 w-10 place-items-center rounded-full border border-accent/35 bg-primary text-accent shadow-[0_8px_18px_rgba(45,31,20,0.15)]">
                        <PackageIcon className="h-5 w-5" />
                      </span>
                    </div>
                    <div className="flex flex-col bg-white px-4 pb-3 pt-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-[20px] font-bold leading-[1.12] text-foreground [font-family:var(--font-package-heading),serif]">
                            {pkg.name}
                          </h2>
                          <p className="mt-1.5 line-clamp-2 min-h-[38px] text-[13px] leading-[1.42] text-[hsl(0_0%_40%)]">
                            {pkg.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[14px] border border-[hsl(35_22%_88%)] bg-[hsl(39_50%_98%)]">
                        <div className="border-r border-[hsl(35_22%_88%)] px-3 py-2">
                          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                            From
                          </p>
                          <strong className="mt-0.5 block text-[18px] font-bold leading-none text-primary [font-family:var(--font-package-heading),serif]">
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
                  <div className="px-4 pb-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-extrabold text-[hsl(0_0%_30%)]">
                        <p>Includes</p>
                        <span className="rounded-full bg-[hsl(41_55%_94%)] px-2 py-0.5 text-[10.5px] font-extrabold text-[hsl(38_52%_34%)]">
                          {pkg.isCustom
                            ? 'Custom menu selection'
                            : `${Math.max(included.length, visibleIncluded.length)} menu highlights`}
                        </span>
                      </div>
                      {visibleIncluded.length ? (
                        <ul className="mb-4 space-y-1.5">
                          {visibleIncluded.slice(0, 4).map((item) => (
                            <li
                              key={`${item.categoryId}-${item.id}`}
                              className="flex min-w-0 items-center gap-2.5 text-[13px] leading-[1.25] text-[hsl(0_0%_26%)]"
                            >
                              <Check
                                className={`h-[15px] w-[15px] shrink-0 ${
                                  pkg.isCustom
                                    ? 'text-emerald-600'
                                    : 'text-primary'
                                }`}
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
                              className="flex min-w-0 items-center gap-2.5 text-[13px] leading-[1.25] text-[hsl(0_0%_26%)]"
                            >
                              <Check
                                className="h-[15px] w-[15px] shrink-0 text-emerald-600"
                                strokeWidth={2.6}
                              />
                              <span className="min-w-0 truncate">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {isMealBox && remainingIncluded.length > 0 && (
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
                          : 'Select package'}
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
