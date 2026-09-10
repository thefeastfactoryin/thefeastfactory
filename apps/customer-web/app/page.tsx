'use client';

import type {
  CartSummary,
  OrderingOffering,
  OperatingRegion,
  PackageConfiguration,
  PackageSummary,
} from '@aranyam/shared-types';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChefHat,
  CircleOff,
  Clock,
  CreditCard,
  Flame,
  Leaf,
  Package as PackageIcon,
  Sprout,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { catalogCopy, offeringDisplay } from '../lib/catalog-display';
import { apiRequest } from '../lib/api';
import { DataImage } from '../components/data-image';
import {
  PackageChangeDialog,
  PackageDetailsModal,
} from '../components/catalog/package-details-modal';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useDeliveryLocationStore } from '../store/delivery-location.store';
import { useSessionStore } from '../store/session.store';
import { usePublicSettings } from '../components/public-settings-provider';
import { KitchenLocationsSection } from '../components/home/kitchen-locations';

const trustIcons = [Users, Clock, CreditCard, Sprout];
const heroTags = [
  { label: 'No Palm Oil', icon: CircleOff },
  { label: 'No Artificial Colors', icon: Leaf },
  { label: 'FSSAI Certified', icon: BadgeCheck },
  { label: 'Delivered Piping Hot', icon: Flame },
];

const offeringIcons: Record<string, LucideIcon> = {
  MEAL_BOX: PackageIcon,
  PACKAGES: CalendarDays,
  CUSTOM_MENU: ChefHat,
};
const offeringFallbackImages: Record<string, string> = {
  MEAL_BOX: '/order-mealbox.png',
  PACKAGES: '/order-occasion.png',
  CUSTOM_MENU: '/order-build.png',
};
export default function HomePage() {
  const publicSettings = usePublicSettings();
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const deliveryLocation = useDeliveryLocationStore((state) => state.location);
  const currentPackage = useOrderBuilderStore((state) => state.package);
  const setPackage = useOrderBuilderStore((state) => state.setPackage);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const setGuestCount = useOrderBuilderStore((state) => state.setGuestCount);
  const reset = useOrderBuilderStore((state) => state.reset);
  const [offerings, setOfferings] = useState<OrderingOffering[]>([]);
  const [kitchenLocations, setKitchenLocations] = useState<OperatingRegion[]>(
    [],
  );
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [configs, setConfigs] = useState<Record<string, PackageConfiguration>>(
    {},
  );
  const [detailsPackage, setDetailsPackage] = useState<PackageSummary>();
  const [pendingPackage, setPendingPackage] = useState<PackageSummary>();
  const [selecting, setSelecting] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [activeCartCount, setActiveCartCount] = useState(0);
  useEffect(() => {
    Promise.all([
      apiRequest<OrderingOffering[]>('/catalog/ordering-offerings'),
      apiRequest<OperatingRegion[]>('/operating-regions'),
      apiRequest<PackageSummary[]>('/packages'),
    ])
      .then(async ([nextOfferings, nextKitchenLocations, rows]) => {
        setOfferings(nextOfferings);
        setKitchenLocations(nextKitchenLocations);
        const featured = rows
          .filter((row) => row.isFeatured && row.activeVersion)
          .sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999))
          .slice(0, 4);
        setPackages(featured);
        const details = await Promise.all(
          featured.map(
            async (pkg) =>
              [
                pkg.id,
                await apiRequest<PackageConfiguration>(
                  `/package-versions/${pkg.activeVersion!.id}/configuration`,
                ),
              ] as const,
          ),
        );
        setConfigs(Object.fromEntries(details));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) {
      setActiveCartCount(0);
      return;
    }
    apiRequest<CartSummary[]>('/cart/all', {}, session.accessToken)
      .then((rows) => setActiveCartCount(rows.length))
      .catch(() => setActiveCartCount(0));
  }, [session]);

  async function selectPackage(pkg: PackageSummary, confirmed = false) {
    if (!pkg.activeVersion || selecting) return;
    const hasExistingCart = session
      ? activeCartCount > 0
      : Boolean(currentPackage);
    if (hasExistingCart && !confirmed) {
      setPendingPackage(pkg);
      return;
    }
    setPendingPackage(undefined);
    setSelecting(pkg.id);
    setSelectionError('');
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
      router.push(`${builder}?${next.toString()}`);
    } catch (reason) {
      setSelectionError((reason as Error).message);
      setSelecting('');
    }
  }

  async function clearCartAndSelect(pkg: PackageSummary) {
    if (session) {
      await apiRequest('/cart', { method: 'DELETE' }, session.accessToken);
    }
    reset();
    setActiveCartCount(0);
    await selectPackage(pkg, true);
  }

  const homeOfferings = offerings
    .filter((offering) =>
      ['MEAL_BOX', 'PACKAGES', 'CUSTOM_MENU'].includes(offering.code),
    )
    .sort(
      (first, second) =>
        ['MEAL_BOX', 'PACKAGES', 'CUSTOM_MENU'].indexOf(first.code) -
        ['MEAL_BOX', 'PACKAGES', 'CUSTOM_MENU'].indexOf(second.code),
    );
  return (
    <main className="bg-background">
      <section
        className="overflow-hidden text-white"
        style={{
          background:
            'radial-gradient(circle at 28% 35%, hsl(41 56% 44% / 0.10), transparent 34%), radial-gradient(circle at 50% 50%, transparent 56%, rgba(28, 0, 8, 0.22) 100%), linear-gradient(135deg, hsl(352 62% 16%), hsl(352 62% 13%))',
        }}
      >
        <div className="mx-auto w-full max-w-[1536px] px-4 sm:px-6 lg:px-12">
          <div className="grid min-w-0 items-center gap-5 py-5 sm:gap-8 sm:py-8 lg:min-h-[430px] lg:grid-cols-[0.94fr_1.2fr] lg:gap-12 lg:py-5">
            <div className="min-w-0 max-w-[590px]">
              <p className="eyebrow">Premium bulk catering</p>
              <h1 className="mt-3 max-w-[570px] font-serif text-[38px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[48px] lg:text-[58px] lg:leading-[0.98]">
                Premium food for every{' '}
                <span className="italic text-accent">occasion</span>
              </h1>
              <p className="mt-4 max-w-[550px] text-[14px] leading-6 text-white/80 sm:text-[15px] sm:leading-7 lg:text-base">
                <span className="sm:hidden">
                  Fresh catering for celebrations, offices and group events,
                  prepared with care and delivered on time.
                </span>
                <span className="hidden sm:inline">
                  Premium catering for birthdays, housewarmings, pujas and
                  family gatherings, with thoughtful menus for corporate events
                  too. Freshly prepared, beautifully presented and delivered on
                  time.
                </span>
              </p>

              <Link
                href="/packages"
                className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-extrabold text-accent-foreground shadow-[0_10px_28px_rgba(211,163,58,0.30)] transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_34px_rgba(211,163,58,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:text-[15px]"
              >
                Order Now <ArrowRight className="h-5 w-5" />
              </Link>

              <div
                className="mt-4 flex max-w-xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible"
                aria-label="Service trust signals"
              >
                {heroTags.map(({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-white/[0.08] px-3 text-[10.5px] font-medium text-white/90 ring-1 ring-inset ring-white/15 sm:h-9 sm:px-3.5 sm:text-[11px]"
                  >
                    <Icon
                      className="h-3.5 w-3.5 text-accent"
                      aria-hidden="true"
                    />
                    <span className="whitespace-nowrap">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-w-0 lg:-mr-8">
              <div className="relative h-[160px] overflow-hidden rounded-[18px] border border-accent/15 shadow-[0_22px_52px_rgba(0,0,0,0.30)] sm:h-auto sm:aspect-[16/9] sm:rounded-[24px] lg:h-[390px] lg:aspect-auto lg:rounded-[26px]">
                <img
                  src="/office-hero.png"
                  alt="A catered Indian buffet arranged in a modern office meeting room"
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <KitchenLocationsSection
        locations={kitchenLocations}
        className="bg-ivory px-4 py-5 sm:px-6 lg:px-10 lg:py-6"
        variant="compact"
      />

      <section id="ordering-styles" className="bg-ivory py-8 sm:py-10 lg:py-12">
        <div className="mx-auto grid w-full max-w-[1440px] gap-4 px-4 sm:grid-cols-2 sm:px-6 md:grid-cols-3 lg:gap-6 lg:px-10">
          {homeOfferings.map((offering) => {
            const display = offeringDisplay[offering.code];
            const Icon = offeringIcons[offering.code] ?? PackageIcon;
            const imageSrc =
              offeringFallbackImages[offering.code] ?? offering.imageUrl!;
            const isCustomPackage = offering.code === 'CUSTOM_MENU';
            return (
              <Link
                key={offering.id}
                href={display.href}
                className="group flex flex-col overflow-hidden rounded-[20px] border border-primary/15 bg-card shadow-[0_12px_34px_rgba(74,43,35,0.08)] transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="relative h-[170px] shrink-0 overflow-hidden bg-muted sm:h-[190px] lg:h-[220px]">
                  <img
                    src={imageSrc}
                    alt={`${offering.title} catering presentation`}
                    className="h-full w-full object-cover transition-transform duration-500 ease-premium group-hover:scale-[1.035] motion-reduce:transition-none"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary shadow-sm">
                    {offering.code === 'MEAL_BOX'
                      ? 'Easy group meals'
                      : offering.code === 'PACKAGES'
                        ? 'Most popular for events'
                        : 'Create your own menu'}
                  </span>
                </div>
                <div className="relative flex min-h-[142px] flex-1 flex-col px-5 pb-5 pt-7 lg:px-6 lg:pb-6">
                  <span className="absolute -top-5 left-5 grid h-11 w-11 place-items-center rounded-full border border-border bg-ivory text-primary shadow-sm lg:left-6">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-serif text-[26px] font-bold leading-tight tracking-tight text-foreground lg:text-[30px]">
                    {isCustomPackage ? 'Custom Package' : offering.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {offering.description}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-3 text-sm font-bold text-primary">
                    {isCustomPackage
                      ? 'Explore custom package'
                      : offering.ctaLabel || 'Explore'}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bg-background py-9 lg:py-12">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Curated for every event</p>
              <h2 className="mt-2 font-serif text-[28px] font-bold tracking-tight sm:text-3xl">
                Popular occasion packages
              </h2>
            </div>
            <Link
              href="/packages"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary"
            >
              View all packages <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
            {packages.map((pkg) => {
              const version = pkg.activeVersion!;
              const includes = configs[pkg.id]?.categoryRules.slice(0, 3) ?? [];
              return (
                <article
                  key={pkg.id}
                  className="group min-w-[82vw] snap-center overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_2px_14px_rgba(0,0,0,0.045)] transition-all duration-250 ease-premium hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover sm:min-w-0"
                >
                  <button
                    type="button"
                    onClick={() => setDetailsPackage(pkg)}
                    className="block w-full text-left"
                    aria-label={`View details for ${pkg.name}`}
                  >
                    <div className="relative h-44 overflow-hidden">
                      <DataImage
                        src={pkg.imageUrl}
                        alt={`${pkg.name} presentation`}
                        className="h-full w-full object-cover transition duration-500 ease-premium group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                      {pkg.badgeLabel && (
                        <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
                          {pkg.badgeLabel}
                        </span>
                      )}
                    </div>
                    <div className="p-4 pb-2">
                      <h3 className="font-serif text-xl font-bold leading-tight">
                        {pkg.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {pkg.description}
                      </p>
                      <div className="mt-3 space-y-1">
                        {includes.map((rule) => (
                          <p
                            key={rule.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <Check className="h-3 w-3 text-emerald-600" />
                            {rule.category.name}
                          </p>
                        ))}
                      </div>
                      <p className="mt-4 text-lg font-extrabold tracking-tight text-primary">
                        From ₹{version.basePricePerPlate}
                        <span className="text-xs font-normal text-muted-foreground">
                          {' '}
                          / person
                        </span>
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-extrabold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        Includes packaging
                      </span>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-2 p-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setDetailsPackage(pkg)}
                      className="min-h-11 rounded-full border border-primary/35 px-3 py-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPackage(pkg)}
                      disabled={Boolean(selecting)}
                      className="min-h-11 rounded-full bg-primary px-3 py-2.5 text-xs font-bold text-white shadow-[0_7px_15px_rgba(122,31,43,0.12)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {selecting === pkg.id
                        ? 'Selecting…'
                        : pkg.isCustom
                          ? 'Build menu'
                          : 'Select'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {selectionError && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {selectionError}
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden border-y border-border bg-ivory">
        <div className="mx-auto flex w-full max-w-[1440px] overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
          {catalogCopy.trust.map(([title, configuredDescription], index) => {
            const Icon = trustIcons[index]!;
            const description =
              title === 'Advance booking'
                ? publicSettings
                  ? `At least ${publicSettings.minBookingLeadHours} hours`
                  : 'Loading booking policy…'
                : configuredDescription;
            return (
              <div
                key={title}
                className="flex min-h-[66px] min-w-[155px] shrink-0 items-center gap-2.5 border-l border-border px-3 py-3 first:border-l-0 sm:min-w-0 sm:odd:border-l-0 sm:even:border-l lg:min-h-[76px] lg:border-l lg:px-7 lg:py-4 lg:first:border-l-0"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary sm:h-10 sm:w-10">
                  <Icon
                    className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h2 className="text-[12px] font-extrabold leading-4 sm:text-sm">
                    {title}
                  </h2>
                  <p className="mt-0.5 hidden text-[11px] leading-4 text-muted-foreground sm:block lg:text-xs lg:leading-5">
                    {description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Change: Remove the duplicate lower trust and promise rows now that assurances live in one band beneath the hero. */}
      {detailsPackage && (
        <PackageDetailsModal
          pkg={detailsPackage}
          config={configs[detailsPackage.id]}
          selecting={selecting === detailsPackage.id}
          onClose={() => setDetailsPackage(undefined)}
          onSelect={() => selectPackage(detailsPackage)}
        />
      )}
      {pendingPackage && (
        <PackageChangeDialog
          currentName={currentPackage?.packageName ?? 'your current package'}
          nextName={pendingPackage.name}
          selecting={selecting === pendingPackage.id}
          onCancel={() => setPendingPackage(undefined)}
          onClear={() => void clearCartAndSelect(pendingPackage)}
          onConfirm={() => selectPackage(pendingPackage, true)}
        />
      )}
    </main>
  );
}
