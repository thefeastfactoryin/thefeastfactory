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
  Check,
  CircleOff,
  Clock,
  CreditCard,
  Flame,
  Leaf,
  Sprout,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  catalogCopy,
  offeringDisplay,
} from '../lib/catalog-display';
import { apiRequest } from '../lib/api';
import { notifyCartCleared } from '../lib/cart-state';
import { DataImage } from '../components/data-image';
import {
  PackageChangeDialog,
  PackageDetailsModal,
} from '../components/catalog/package-details-modal';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useDeliveryLocationStore } from '../store/delivery-location.store';
import { useSessionStore } from '../store/session.store';
import { KitchenLocationsSection } from '../components/home/kitchen-locations';

const trustIcons = [Users, Clock, CreditCard, Sprout];
const heroTags = [
  { label: 'No Palm Oil', icon: CircleOff },
  { label: 'No Artificial Colors', icon: Leaf },
  { label: 'FSSAI Certified', icon: BadgeCheck },
  { label: 'Delivered Piping Hot', icon: Flame },
];

function formatDiscoveryPrice(value: string | number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(value));
}

const orderOptionCopy = {
  PACKAGES: {
    label: 'COMPLETE MENU',
    title: 'Packages',
    description: 'Curated menus for every celebration',
    image: '/order-occasion.png',
    imagePosition: 'center 62%',
    alt: 'A complete catered spread prepared for a celebration',
  },
  MEAL_BOX: {
    label: 'INDIVIDUAL MEALS',
    title: 'Meal Boxes',
    description: 'Complete meals, individually packed',
    image: '/order-mealbox.png',
    imagePosition: 'center 50%',
    alt: 'An individual compartment meal box',
  },
  ORDER_BY_KG: {
    label: 'BULK DISHES',
    title: 'Order by KG',
    description: 'Your favourite dishes, by the kilo',
    image: '/order-by-kg-bulk.png',
    imagePosition: 'center 55%',
    alt: 'Bulk dishes prepared for ordering by weight',
  },
  CUSTOM_MENU: {
    label: 'CUSTOM MENU',
    title: 'Build Your Own',
    description: 'Pick your dishes. Make it yours.',
    image: '/order-build.png',
    imagePosition: 'center 50%',
    alt: 'A varied spread of dishes for a custom menu',
  },
} as const;
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

export default function HomePage() {
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
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const [kgAvailableAtLocation, setKgAvailableAtLocation] = useState(true);
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
      apiRequest<PackageSummary[]>(
        `/packages${deliveryLocation?.resolution.region?.id ? `?regionId=${deliveryLocation.resolution.region.id}` : ''}`,
      ),
    ])
      .then(async ([nextOfferings, nextKitchenLocations, rows]) => {
        setOfferings(nextOfferings);
        setKitchenLocations(nextKitchenLocations);
        setKgAvailableAtLocation(
          rows.some(
            (row) => row.type === 'ORDER_BY_KG' && Boolean(row.activeVersion),
          ),
        );
        const featured = rows
          .filter(
            (row) =>
              row.isFeatured && row.activeVersion && row.type !== 'ORDER_BY_KG',
          )
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
  }, [deliveryLocation?.resolution.region?.id]);

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
    notifyCartCleared();
    setActiveCartCount(0);
    await selectPackage(pkg, true);
  }

  const offeringOrder = ['PACKAGES', 'MEAL_BOX', 'ORDER_BY_KG', 'CUSTOM_MENU'];
  const homeOfferings = offerings
    .filter(
      (offering) =>
        offeringOrder.includes(offering.code) &&
        (offering.code !== 'ORDER_BY_KG' || kgAvailableAtLocation),
    )
    .sort(
      (first, second) =>
        offeringOrder.indexOf(first.code) - offeringOrder.indexOf(second.code),
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
          <div className="grid min-w-0 items-center gap-4 py-7 sm:gap-6 sm:py-9 lg:min-h-[480px] lg:grid-cols-[0.95fr_1.1fr] lg:gap-10 lg:py-10">
            <div className="min-w-0 max-w-[590px]">
              <p className="eyebrow">Food for gatherings</p>
              <h1 className="mt-3 max-w-[570px] font-serif text-[30px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[38px] lg:text-[48px] lg:leading-[0.98]">
                Food for every gathering, made simple.
              </h1>
              <p className="mt-4 max-w-[540px] text-[14px] leading-6 text-white/80 sm:text-[15px] sm:leading-7">
                Choose a complete event package, individual meal boxes, order dishes by kg, or build your own menu.
              </p>

              <Link
                href="#ordering-styles"
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-extrabold text-accent-foreground shadow-[0_10px_28px_rgba(211,163,58,0.30)] transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_34px_rgba(211,163,58,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary sm:text-[15px]"
              >
                Explore Food Options <ArrowRight className="h-5 w-5" />
              </Link>

              <div
                className="mt-4 flex max-w-xl flex-wrap gap-2 lg:max-w-[540px]"
                aria-label="Service trust signals"
              >
                {heroTags.map(({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="inline-flex min-h-8 items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[10.5px] font-medium text-white/90 ring-1 ring-inset ring-white/15 sm:min-h-9 sm:px-3.5 sm:text-[11px]"
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0 text-accent"
                      aria-hidden="true"
                    />
                    <span className="leading-none">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-w-0 lg:-mr-8">
              <div className="relative h-[240px] overflow-hidden rounded-[18px] border border-accent/15 shadow-[0_20px_40px_rgba(0,0,0,0.28)] sm:h-[320px] sm:aspect-[16/9] sm:rounded-[24px] lg:h-[440px] lg:aspect-auto lg:rounded-[26px]">
                {heroImages.map((image, index) => (
                  <img
                    key={image.src}
                    src={image.src}
                    alt={index === activeHeroImage ? image.alt : ''}
                    aria-hidden={index !== activeHeroImage}
                    className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 motion-reduce:transition-none ${
                      index === activeHeroImage ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="ordering-styles" className="bg-ivory py-5 sm:py-6 lg:py-7">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="mb-3 max-w-[540px] sm:mb-4">
            <p className="eyebrow hidden sm:block">Choose your order style</p>
            <h2 className="mt-2 font-serif text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[30px]">
              How would you like to order?
            </h2>
            {/* <p className="mt-2 text-sm text-muted-foreground">
              Choose the option that works best for your gathering.
            </p> */}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:hidden">
            {homeOfferings.map((offering) => {
              const display = offeringDisplay[offering.code];
              const copy =
                orderOptionCopy[
                  offering.code as keyof typeof orderOptionCopy
                ];
              if (!copy) return null;
              return (
                <Link
                  key={offering.id}
                  href={display.href}
                  className="group flex min-h-[174px] min-w-0 flex-col overflow-hidden rounded-[10px] border border-primary/15 bg-card text-left transition-colors hover:border-primary/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
                >
                  <div className="h-[84px] shrink-0 overflow-hidden bg-muted">
                    <img
                      src={copy.image}
                      alt={copy.alt}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: copy.imagePosition }}
                    />
                  </div>
                  <div className="relative flex min-h-0 flex-1 flex-col px-2.5 pb-2 pt-2">
                    <h3 className="mt-0.5 font-sans text-[16px] font-semibold leading-[1.08] text-foreground">
                      {copy.title ?? offering.title}
                    </h3>
                    <p className="mt-0.5 pr-5 text-[11.5px] leading-[1.25] text-muted-foreground/90">
                      {copy.description}
                    </p>
                    <ArrowRight
                      className="absolute bottom-2 right-2 h-3.5 w-3.5 text-primary/70 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="hidden gap-2.5 sm:grid sm:grid-cols-2 xl:grid-cols-4">
            {homeOfferings.map((offering) => {
              const display = offeringDisplay[offering.code];
              const copy = orderOptionCopy[offering.code as keyof typeof orderOptionCopy];
              return (
                <Link
                  key={offering.id}
                  href={display.href}
                  className="group flex min-h-[122px] flex-col justify-between rounded-[12px] border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <div className="mb-3 h-24 overflow-hidden rounded-[8px] bg-muted">
                    {copy && (
                      <img
                        src={copy.image}
                        alt={copy.alt}
                        className="h-full w-full object-cover"
                        style={{ objectPosition: copy.imagePosition }}
                      />
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-primary/80">
                        {copy?.label ?? offering.code}
                      </p>
                      <h3 className="mt-2 font-sans text-[20px] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
                        {copy?.title ?? offering.title}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="max-w-[18ch] text-[12.5px] leading-5 text-muted-foreground">
                      {copy?.description ?? offering.description}
                    </p>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-primary transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none">
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-background py-7 sm:py-12 lg:py-16">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Curated for every event</p>
              <h2 className="mt-2 font-serif text-[24px] font-bold leading-[1.12] tracking-[-0.015em] sm:text-[28px]">
                Popular occasion packages
              </h2>
            </div>
            <Link
              href="/packages"
              className="hidden items-center gap-1.5 text-sm font-bold text-primary sm:inline-flex"
            >
              View all packages <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:hidden">
            {packages.slice(0, 3).map((pkg) => {
              const version = pkg.activeVersion!;
              return (
                <article
                  key={pkg.id}
                  className="group overflow-hidden rounded-[12px] border border-border/80 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-colors hover:border-primary/25 hover:bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setDetailsPackage(pkg)}
                    className="relative grid min-h-[116px] w-full grid-cols-[96px_minmax(0,1fr)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    aria-label={`View details for ${pkg.name}`}
                  >
                    <div className="h-full min-h-[116px] overflow-hidden">
                      <DataImage
                        src={pkg.imageUrl}
                        alt={`${pkg.name} presentation`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="relative min-w-0 px-3 py-2.5 pr-9">
                      {pkg.badgeLabel && (
                        <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-primary/70">
                          {pkg.badgeLabel}
                        </p>
                      )}
                      <h3 className="mt-0.5 font-sans text-[18px] font-semibold leading-[1.1] text-foreground">
                        {pkg.name}
                      </h3>
                      <p className="money-text mt-1.5 text-sm font-bold leading-none text-primary">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          From{' '}
                        </span>
                        ₹{formatDiscoveryPrice(version.basePricePerPlate)}
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {' '}/ person
                        </span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-[10.5px] font-normal leading-[1.25] text-muted-foreground/85">
                        {pkg.description}
                      </p>
                      <ArrowRight
                        className="absolute bottom-2.5 right-3 h-4 w-4 text-primary/70 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                </article>
              );
            })}
          </div>

          <div className="mt-8 hidden gap-4 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
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
                    <div className="relative h-52 overflow-hidden">
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
                    <div className="p-5 pb-2">
                      <h3 className="font-sans text-xl font-semibold leading-[1.12] tracking-[-0.015em]">
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
                      <p className="money-text mt-4 text-lg font-extrabold tracking-tight text-primary">
                        From ₹{formatDiscoveryPrice(version.basePricePerPlate)}
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
          <Link
            href="/packages"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary sm:hidden"
          >
            View all packages <ArrowRight className="h-4 w-4" />
          </Link>
          {selectionError && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {selectionError}
            </p>
          )}
        </div>
      </section>

      <section className="bg-background py-5 lg:py-7">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="mb-4 max-w-[540px]">
            <p className="eyebrow">Simple process</p>
            <h2 className="mt-2 font-serif text-[24px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[28px]">
              How it works
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { step: '01', title: 'Choose your food', description: 'Pick a package, meal boxes, bulk dishes or create your own menu.' },
              { step: '02', title: 'Add event details', description: 'Tell us your guest count, delivery location, date and time.' },
              { step: '03', title: 'Review & confirm', description: 'Review your menu, total and delivery details before payment.' },
            ].map((item) => (
              <div key={item.step} className="rounded-[12px] border border-border bg-card p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                    {item.step}
                  </span>
                  <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-border bg-ivory">
        <div className="mx-auto flex w-full max-w-[1440px] overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
          {catalogCopy.trust.map(([title, configuredDescription], index) => {
            const Icon = trustIcons[index]!;
            const description = configuredDescription;
            return (
              <div
                key={title}
                className="flex min-h-[58px] min-w-[155px] shrink-0 items-center gap-2.5 border-l border-border px-3 py-2.5 first:border-l-0 sm:min-w-0 sm:odd:border-l-0 sm:even:border-l lg:min-h-[64px] lg:border-l lg:px-7 lg:py-3 lg:first:border-l-0"
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

      <KitchenLocationsSection
        locations={kitchenLocations}
        className="bg-ivory px-4 py-8 sm:px-6 sm:py-9 lg:px-10 lg:py-10"
        variant="compact"
      />

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
