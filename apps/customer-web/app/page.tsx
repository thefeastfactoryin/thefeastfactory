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
  CalendarDays,
  Check,
  ChefHat,
  Clock,
  CreditCard,
  MessageCircle,
  Package as PackageIcon,
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
import { useSessionStore } from '../store/session.store';
import { usePublicSettings } from '../components/public-settings-provider';
import { KitchenLocationsSection } from '../components/home/kitchen-locations';

const trustIcons = [Users, Clock, CreditCard, MessageCircle];
const heroTags = [
  '🚫 No Palm Oil',
  '🌿 No Artificial Colors',
  '🛡️ FSSAI Certified',
  '🔥 Delivered Piping Hot',
];
const heroImages = [
  {
    src: '/office-hero.png',
    alt: 'A catered Indian buffet arranged in a modern office meeting room',
  },
  {
    src: '/pooja-thali.png',
    alt: 'A festive Indian pooja thali served beside flowers and a lit diya',
  },
  {
    src: '/farmhouse-hero.png',
    alt: 'An outdoor farmhouse catering spread prepared for an evening event',
  },
];

const offeringIcons: Record<string, LucideIcon> = {
  MEAL_BOX: PackageIcon,
  PACKAGES: CalendarDays,
  CUSTOM_MENU: ChefHat,
};
const offeringFallbackImages: Record<string, string> = {
  MEAL_BOX: '/ordering-meal-box-v2.png',
  PACKAGES: '/farmhouse-hero.png',
  CUSTOM_MENU: '/packages-hero-plated.png',
};
export default function HomePage() {
  const publicSettings = usePublicSettings();
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
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
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  // Change: Cross-fade the gallery at a calm pace to add warmth without distracting from the ordering CTAs.
  useEffect(() => {
    const interval = window.setInterval(
      () => setActiveHeroImage((current) => (current + 1) % heroImages.length),
      5000,
    );
    return () => window.clearInterval(interval);
  }, []);
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
    const hasExistingCart = session ? activeCartCount > 0 : Boolean(currentPackage);
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
              }),
            },
            session.accessToken,
          )
        : undefined;
      setPackage(selected);
      setDbCartId(cart?.id, session?.user.id);
      setGuestCount(pkg.activeVersion.minGuestCount);
      setActiveCartCount((count) => count + 1);
      const builder = pkg.type === 'CUSTOM_PACKAGE' ? '/packages/build' : '/cart';
      const next = new URLSearchParams({
        packageVersionId: pkg.activeVersion.id,
      });
      if (cart?.id) next.set('cartId', cart.id);
      router.push(
        pkg.type === 'CUSTOM_PACKAGE' ? `${builder}?${next.toString()}` : builder,
      );
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

  return (
    <main className="bg-background">
      <section
        className="overflow-hidden text-white"
        style={{
          background:
            'radial-gradient(circle at 28% 35%, hsl(41 56% 44% / 0.10), transparent 34%), radial-gradient(circle at 50% 50%, transparent 56%, rgba(28, 0, 8, 0.22) 100%), linear-gradient(135deg, hsl(352 62% 16%), hsl(352 62% 13%))',
        }}
      >
        <div className="container-pad">
          <div className="grid items-center gap-6 py-8 sm:gap-8 sm:py-10 lg:min-h-[448px] lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:py-12">
            <div className="max-w-xl">
              <p className="eyebrow">Premium bulk catering</p>
              <h1 className="mt-4 font-serif text-4xl font-bold leading-[0.98] tracking-tight sm:text-[42px] lg:text-[3.75rem]">
                Premium food for every{' '}
                <span className="italic text-accent">occasion</span>
              </h1>
              {/* Change: Lead with the family occasions the service is built around, while keeping corporate catering secondary. */}
              <p className="mt-4 max-w-[480px] text-[15px] leading-7 text-white/75">
                Premium catering for birthdays, housewarmings, pujas and family
                gatherings, with thoughtful menus for corporate events too.
                Freshly prepared, beautifully presented and delivered on time.
              </p>

              <Link
                href="/packages"
                className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-8 text-base font-extrabold text-accent-foreground shadow-[0_10px_28px_rgba(211,163,58,0.30)] transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_34px_rgba(211,163,58,0.38)]"
              >
                Order Now <ArrowRight className="h-5 w-5" />
              </Link>

              <div
                className="mt-5 flex max-w-xl flex-wrap gap-2"
                aria-label="Service trust signals"
              >
                {heroTags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex h-8 w-full items-center gap-2 rounded-full bg-white/[0.08] px-3 text-[11px] font-medium text-white/85 ring-1 ring-inset ring-white/15 sm:w-auto"
                  >
                    <span className="whitespace-nowrap">{tag}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative lg:-mr-16">
              {/* Change: Replace the single tray photograph with a restrained cross-fade gallery and a straighter crop for visual contrast. */}
              <div className="relative aspect-[16/9] overflow-hidden rounded-[10px] border border-accent/15 shadow-[0_22px_52px_rgba(0,0,0,0.30)] lg:aspect-[1.7/1]">
                {heroImages.map((image, index) => (
                  <img
                    key={image.src}
                    src={image.src}
                    alt={index === activeHeroImage ? image.alt : ''}
                    aria-hidden={index !== activeHeroImage}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 motion-reduce:transition-none ${
                      index === activeHeroImage ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Change: Consolidate all service assurances into one squared-off trust band directly beneath the hero. */}
      <section className="border-b border-border bg-ivory">
        <div className="container-pad grid sm:grid-cols-2 lg:grid-cols-4">
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
                className="flex items-start gap-3 border-border px-4 py-5 sm:border-r sm:last:border-r-0 lg:px-5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <KitchenLocationsSection
        locations={kitchenLocations}
        className="bg-ivory py-10 lg:py-12"
      />

      <section id="ordering-styles" className="container-pad py-10 lg:py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="eyebrow font-semibold">How you order</p>
          <h2 className="mt-2 font-[family-name:var(--font-home-display)] text-3xl font-semibold leading-10 tracking-tight sm:text-4xl">
            Choose the ordering style that fits your event
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {offerings.map((offering) => {
            const display = offeringDisplay[offering.code];
            const Icon = offeringIcons[offering.code] ?? PackageIcon;
            const imageSrc =
              offering.imageUrl ?? offeringFallbackImages[offering.code]!;
            return (
              <Link
                key={offering.id}
                href={display.href}
                className="group flex h-[340px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="relative h-40 shrink-0 overflow-hidden bg-muted">
                  <img
                    src={imageSrc}
                    alt={`${offering.title} catering presentation`}
                    className="h-full w-full object-cover transition-transform duration-500 ease-premium group-hover:scale-[1.035] motion-reduce:transition-none"
                  />
                </div>
                <div className="relative flex min-h-0 flex-1 flex-col px-6 pb-5 pt-7">
                  <span className="absolute -top-5 left-6 grid h-10 w-10 place-items-center rounded-lg border border-border bg-ivory text-primary shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-[family-name:var(--font-home-display)] text-[36px] font-semibold leading-10 tracking-tight text-foreground">
                    {offering.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-base leading-6 text-muted-foreground">
                    {offering.description}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-2 text-[15px] font-semibold text-primary">
                    {offering.ctaLabel || 'Explore'}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-pad pb-12 lg:pb-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Curated for every event</p>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight">
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
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => {
            const version = pkg.activeVersion!;
            const includes = configs[pkg.id]?.categoryRules.slice(0, 3) ?? [];
            return (
              <article
                key={pkg.id}
                className="group overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_2px_14px_rgba(0,0,0,0.045)] transition-all duration-250 ease-premium hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover"
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
