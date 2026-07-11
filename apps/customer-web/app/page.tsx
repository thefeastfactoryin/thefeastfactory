'use client';

import type {
  OrderingOffering,
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
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  catalogCopy,
  offeringDisplay,
} from '../lib/catalog-display';
import { apiRequest } from '../lib/api';
import { Advantages } from '../components/home/advantages';
import { DataImage } from '../components/data-image';
import {
  PackageChangeDialog,
  PackageDetailsModal,
} from '../components/catalog/package-details-modal';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useSessionStore } from '../store/session.store';
import { usePublicSettings } from '../components/public-settings-provider';

const trustIcons = [Users, Clock, CreditCard, MessageCircle];
const heroTrust = [
  { icon: ShieldCheck, label: 'Hygienic preparation' },
  { icon: Truck, label: 'On-time delivery' },
  { icon: CreditCard, label: 'Transparent pricing' },
];
const offeringIcons: Record<string, LucideIcon> = {
  MEAL_BOX: PackageIcon,
  PACKAGES: CalendarDays,
  CUSTOM_MENU: ChefHat,
};
export default function HomePage() {
  const publicSettings = usePublicSettings();
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const currentPackage = useOrderBuilderStore((state) => state.package);
  const setPackage = useOrderBuilderStore((state) => state.setPackage);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const setGuestCount = useOrderBuilderStore((state) => state.setGuestCount);
  const [offerings, setOfferings] = useState<OrderingOffering[]>([]);
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [configs, setConfigs] = useState<Record<string, PackageConfiguration>>(
    {},
  );
  const [detailsPackage, setDetailsPackage] = useState<PackageSummary>();
  const [pendingPackage, setPendingPackage] = useState<PackageSummary>();
  const [selecting, setSelecting] = useState('');
  const [selectionError, setSelectionError] = useState('');
  useEffect(() => {
    Promise.all([
      apiRequest<OrderingOffering[]>('/catalog/ordering-offerings'),
      apiRequest<PackageSummary[]>('/packages'),
    ])
      .then(async ([nextOfferings, rows]) => {
        setOfferings(nextOfferings);
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

  async function selectPackage(pkg: PackageSummary, confirmed = false) {
    if (!pkg.activeVersion || selecting) return;
    if (
      currentPackage &&
      currentPackage.packageVersionId !== pkg.activeVersion.id &&
      !confirmed
    ) {
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
      router.push(`${builder}?${next.toString()}`);
    } catch (reason) {
      setSelectionError((reason as Error).message);
      setSelecting('');
    }
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
                <span className="italic text-accent">occasion</span>.
              </h1>
              <p className="mt-4 max-w-[460px] text-[15px] leading-7 text-white/75">
                Premium catering for birthdays, weddings, office events and
                celebrations. Freshly prepared, beautifully presented and
                delivered on time.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/packages"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-primary shadow-[0_9px_22px_rgba(0,0,0,0.16)] transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_13px_28px_rgba(0,0,0,0.18)]"
                >
                  View packages <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/menu"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-accent/30 bg-primary/15 px-6 text-sm font-bold text-white transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Browse menu
                </Link>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {heroTrust.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 whitespace-nowrap text-[13px] font-bold leading-tight text-white/90"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-accent">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative lg:-mr-16">
              <div className="absolute -bottom-3 -right-3 hidden h-full w-full rounded-[24px] border border-accent/15 lg:block" />
              <div className="relative overflow-hidden rounded-[24px] border border-accent/15 shadow-[0_22px_52px_rgba(0,0,0,0.30)]">
                <img
                  src="/Hero.png"
                  alt="Catering trays prepared for a celebration"
                  className="aspect-[16/9] w-full scale-[1.03] object-cover transition-transform duration-500 ease-premium hover:scale-[1.045] lg:aspect-[1.7/1] lg:scale-[1.18] lg:hover:scale-[1.2]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-pad py-10 lg:py-12">
        <div className="mx-auto mb-7 max-w-2xl text-center">
          <p className="eyebrow">How you order</p>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-[1.8rem]">
            Choose the ordering style that fits your event
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {offerings.map((offering) => {
            const display = offeringDisplay[offering.code];
            const Icon = offeringIcons[offering.code] ?? PackageIcon;
            return (
              <Link
                key={offering.id}
                href={display.href}
                className="group grid min-h-[200px] overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_2px_14px_rgba(0,0,0,0.045)] transition-all duration-250 ease-premium hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover sm:grid-cols-[1fr_38%] lg:grid-cols-[1fr_34%]"
              >
                <div className="flex flex-col justify-between p-5">
                  <div>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 font-serif text-xl font-bold leading-tight">
                      {offering.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {offering.description}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                    {offering.ctaLabel || 'Explore'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
                <div className="relative min-h-44 overflow-hidden sm:min-h-full">
                  <DataImage
                    src={offering.imageUrl}
                    alt={offering.title}
                    className="h-full w-full object-cover transition duration-500 ease-premium group-hover:scale-105"
                  />
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

      <section className="container-pad pb-14 lg:pb-20">
        <div className="grid overflow-hidden rounded-2xl border border-border/80 bg-ivory shadow-[0_2px_14px_rgba(0,0,0,0.04)] sm:grid-cols-2 lg:grid-cols-4">
          {catalogCopy.trust.map(([title, configuredDescription], index) => {
            const Icon = trustIcons[index]!;
            const desc =
              title === 'Advance booking'
                ? publicSettings
                  ? `At least ${publicSettings.minBookingLeadHours} hours`
                  : 'Loading booking policy…'
                : configuredDescription;
            return (
              <div
                key={title}
                className="flex items-start gap-3 border-border p-5 lg:border-r last:border-r-0"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <Advantages />
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
          onConfirm={() => selectPackage(pendingPackage, true)}
        />
      )}
    </main>
  );
}
