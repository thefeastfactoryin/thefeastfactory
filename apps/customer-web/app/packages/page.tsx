'use client';

import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  Headphones,
  IndianRupee,
  ShieldCheck,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MenuItem, PackageConfiguration, PackageSummary } from '@aranyam/shared-types';
import { cn } from '../../lib/utils';

type PkgItem = PackageConfiguration['categoryRules'][number]['items'][number];

/* ─── Package card data ─── */
interface PkgCard {
  name: string;
  desc: string;
  serves: string | null;
  image: string;
  href: string;
  isBuild: boolean;
  includes: string[];
  badge?: string;
}

const PKG_CARDS: PkgCard[] = [
  {
    name: 'Pooja Package',
    desc: 'Ideal for religious ceremonies, poojas, housewarmings and traditional functions.',
    serves: '20 – 500 Guests',
    image: '/pkg-puja.png',
    href: '/packages/puja',
    isBuild: false,
    badge: 'Popular',
    includes: [
      'Traditional Menu',
      'Sweets',
      'Main Course',
      'Rice & Bread',
      'Dessert',
    ],
  },
  {
    name: 'Farm House Celebration',
    desc: 'Perfect for birthdays, weekend parties, family get-togethers and casual celebrations.',
    serves: '20 – 200 Guests',
    image: '/pkg-farmhouse.png',
    href: '/packages/farmhouse',
    isBuild: false,
    includes: [
      '2 Starters',
      '2 Main Courses',
      'Rice & Bread',
      'Dessert',
      'Beverage',
    ],
  },
  {
    name: 'Corporate Gathering',
    desc: 'Ideal for team lunches, annual events, client meets and office celebrations.',
    serves: '20 – 1,000 Guests',
    image: '/pkg-corporate.png',
    href: '/packages/corporate',
    isBuild: false,
    includes: [
      'Premium Starters',
      'Main Course',
      'Rice & Bread',
      'Dessert',
      'Beverage',
    ],
  },
  {
    name: 'Build Your Own Package',
    desc: 'Pick your favourite dishes and create a custom menu that fits your needs perfectly.',
    serves: null,
    image: '/order-build.png',
    href: '/packages/build',
    isBuild: true,
    includes: [
      'Choose any items',
      'Customise portions',
      'Add / remove items',
      'Perfect for any occasion',
    ],
  },
];

/* ─── Compare table ─── */
const COMPARE_COLS = [
  { label: 'POOJA PACKAGE', color: 'hsl(352 59% 38%)' },
  { label: 'FARM HOUSE CELEBRATION', color: 'hsl(38 52% 42%)' },
  { label: 'CORPORATE GATHERING', color: 'hsl(0 0% 28%)' },
  { label: 'BUILD YOUR OWN', color: 'hsl(0 0% 28%)' },
];

type Cell = { type: 'check' } | { type: 'dash' } | { type: 'text'; value: string } | { type: 'custom' };

const COMPARE_ROWS: { label: string; cells: Cell[]; highlight?: boolean }[] = [
  { label: 'Starters',     cells: [{ type: 'text', value: '1' }, { type: 'text', value: '2' }, { type: 'text', value: '2' }, { type: 'custom' }] },
  { label: 'Main Course',  cells: [{ type: 'text', value: '2' }, { type: 'text', value: '2' }, { type: 'text', value: '2' }, { type: 'custom' }] },
  { label: 'Rice & Bread', cells: [{ type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'custom' }] },
  { label: 'Dessert',      cells: [{ type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'custom' }] },
  { label: 'Beverage',     cells: [{ type: 'dash' },  { type: 'check' }, { type: 'check' }, { type: 'custom' }] },
  { label: 'Serves',       cells: [
    { type: 'text', value: '20 – 500' },
    { type: 'text', value: '20 – 200' },
    { type: 'text', value: '20 – 1000' },
    { type: 'text', value: '20 – 1000' },
  ], highlight: true },
];

function CellValue({ cell }: { cell: Cell }) {
  if (cell.type === 'check') return <Check className="mx-auto h-[18px] w-[18px] text-emerald-600" strokeWidth={2.6} />;
  if (cell.type === 'dash')  return <span className="text-base text-muted-foreground">—</span>;
  if (cell.type === 'custom') return <span className="text-sm font-bold text-primary">Custom</span>;
  return <span className="text-sm font-bold text-foreground">{cell.value}</span>;
}

/* ─── Bottom features ─── */
const BOTTOM_FEATURES = [
  { title: 'Expertly Curated Menus',       sub: 'Crafted by culinary experts' },
  { title: 'On-time Delivery',              sub: 'Punctual delivery for every event' },
  { title: 'No Hidden Charges',            sub: '100% transparent pricing' },
  { title: 'Hygienic & Safe Preparation',  sub: 'Made with premium ingredients' },
];

/* ─── Hero features ─── */
const HERO_FEATURES = [
  { Icon: ChefHat, label: 'Freshly Prepared on the Day' },
  { Icon: ShieldCheck, label: 'Hygienic Kitchen Practices' },
  { Icon: Clock3, label: 'On-Time Delivery' },
  { Icon: IndianRupee, label: 'Transparent Pricing' },
];

const TRUST_STRIP = [
  { Icon: Users, label: 'Trusted for family celebrations' },
  { Icon: Utensils, label: 'Freshly cooked for every order' },
  { Icon: Headphones, label: 'Support from enquiry to delivery' },
  { Icon: Users, label: 'Menus for 20-1000 guests' },
];

/* ─── Veg / Non-veg dot indicator ─── */
function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? 'hsl(140 50% 38%)' : 'hsl(0 70% 45%)';
  return (
    <span style={{
      width: 12, height: 12, borderRadius: 3, flexShrink: 0,
      border: `2px solid ${color}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'block' }} />
    </span>
  );
}

export default function PackagesPage() {
  const [summaries, setSummaries] = useState<PackageSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, PackageConfiguration>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [swappedItems, setSwappedItems] = useState<Record<string, PkgItem>>({});
  const [swapOpen, setSwapOpen] = useState<string | null>(null);
  const [swapAlts, setSwapAlts] = useState<Record<string, MenuItem[]>>({});
  const [swapLoading, setSwapLoading] = useState(false);

  useEffect(() => {
    fetch('/api/packages')
      .then((r) => r.json())
      .then((data: PackageSummary[]) => setSummaries(data))
      .catch(() => {});
  }, []);

  // Map cards to API packages by position, not by name.
  // FIXED_PACKAGE entries (in displayOrder) map to the 3 occasion cards;
  // the single CUSTOM_PACKAGE maps to the "Build Your Own" card.
  const fixedPkgs = summaries.filter((s) => s.type === 'FIXED_PACKAGE');
  const customPkg = summaries.find((s) => s.type === 'CUSTOM_PACKAGE');

  function getApiPkg(pkg: PkgCard): PackageSummary | undefined {
    if (pkg.isBuild) return customPkg;
    const idx = PKG_CARDS.filter((c) => !c.isBuild).indexOf(pkg);
    return fixedPkgs[idx];
  }

  async function toggleDetails(apiPkg: PackageSummary) {
    if (expandedId === apiPkg.id) {
      setExpandedId(null);
      setSwapOpen(null);
      return;
    }
    setExpandedId(apiPkg.id);
    if (configs[apiPkg.id] || !apiPkg.activeVersion) return;

    setLoadingId(apiPkg.id);
    try {
      const res = await fetch(`/api/package-versions/${apiPkg.activeVersion.id}/configuration`);
      if (res.ok) {
        const config: PackageConfiguration = await res.json();
        setConfigs((prev) => ({ ...prev, [apiPkg.id]: config }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  function closeDetails() {
    setExpandedId(null);
    setSwapOpen(null);
  }

  useEffect(() => {
    if (!expandedId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDetails();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [expandedId]);

  function getDisplayItems(rule: PackageConfiguration['categoryRules'][number], pkgId: string): PkgItem[] {
    const count = Math.min(rule.maxSelections, rule.items.length);
    return Array.from({ length: count }, (_, i) => swappedItems[`${pkgId}:${rule.id}:${i}`] ?? rule.items[i]!);
  }

  function getDisplayedIds(rule: PackageConfiguration['categoryRules'][number], pkgId: string): Set<string> {
    return new Set(getDisplayItems(rule, pkgId).map((i) => i.id));
  }

  function isSlotSwappable(rule: PackageConfiguration['categoryRules'][number], position: number): boolean {
    return rule.items[position]?.isSwappable === true;
  }

  function hasSwappableItems(config: PackageConfiguration): boolean {
    return config.categoryRules.some((rule) =>
      getDisplayItems(rule, config.packageId).some((_, idx) => isSlotSwappable(rule, idx)),
    );
  }

  function getMenuHighlightRows(config: PackageConfiguration, pkgId: string) {
    return config.categoryRules.flatMap((rule) =>
      getDisplayItems(rule, pkgId).map((item, idx) => ({
        rule,
        item,
        idx,
        swapKey: `${pkgId}:${rule.id}:${idx}`,
        canSwap: isSlotSwappable(rule, idx),
      })),
    );
  }

  async function openSwap(swapKey: string, categoryId: string) {
    if (swapOpen === swapKey) { setSwapOpen(null); return; }
    setSwapOpen(swapKey);
    if (swapAlts[categoryId]) return;
    setSwapLoading(true);
    try {
      const res = await fetch(`/api/menu/items?categoryId=${categoryId}`);
      if (res.ok) {
        const items: MenuItem[] = await res.json();
        setSwapAlts((prev) => ({ ...prev, [categoryId]: items }));
      }
    } finally {
      setSwapLoading(false);
    }
  }

  function handleSwap(
    pkgId: string,
    rule: PackageConfiguration['categoryRules'][number],
    position: number,
    alt: MenuItem,
  ) {
    const canSwapSlot = isSlotSwappable(rule, position);
    const asItem: PkgItem = {
      ...alt,
      isSwappable: canSwapSlot,
      basePrice: '0.00',
      boxPrice: '0.00',
      generalPrice: '0.00',
      itemPrice: '0.00',
      includedValue: '0.00',
      adjustmentAmount: '0.00',
    };
    setSwappedItems((prev) => ({ ...prev, [`${pkgId}:${rule.id}:${position}`]: asItem }));
    setSwapOpen(null);
  }

  const selectedApiPkg = expandedId ? summaries.find((pkg) => pkg.id === expandedId) : undefined;
  const selectedCard = selectedApiPkg ? PKG_CARDS.find((pkg) => getApiPkg(pkg)?.id === selectedApiPkg.id) : undefined;
  const selectedConfig = selectedApiPkg ? configs[selectedApiPkg.id] : undefined;
  const selectedActiveVersion = selectedApiPkg?.activeVersion;
  const selectedGuestRange = selectedActiveVersion
    ? `${selectedActiveVersion.minGuestCount}-${selectedActiveVersion.maxGuestCount ?? '1000'} guests`
    : selectedCard?.serves;
  const selectedStartingPrice = selectedConfig?.basePricePerPlate ?? selectedActiveVersion?.basePricePerPlate;

  return (
    <main className="bg-[hsl(37_38%_96%)] pb-20">

      {/* ══════════════════════════════ HERO ══════════════════════════════ */}
      <section className="relative isolate overflow-hidden bg-[hsl(352_59%_16%)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/packages-hero-food.png')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, hsla(352,60%,13%,0.92) 0%, hsla(352,59%,15%,0.76) 34%, hsla(352,59%,15%,0.26) 66%, hsla(0,0%,0%,0.06) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 18% 30%, hsla(41,62%,45%,0.14), transparent 28%), linear-gradient(180deg, hsla(0,0%,0%,0.07), hsla(352,60%,13%,0.14))',
          }}
        />

        <div className="relative z-[1] mx-auto max-w-7xl px-4 pb-6 pt-10 sm:px-6 lg:px-8 lg:pb-8 lg:pl-16 lg:pt-14">
          <div className="max-w-[560px]">
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[hsl(41_58%_62%)]">
              Premium Bulk Catering
            </div>
            <h1
              className="font-serif text-[40px] leading-[0.95] tracking-tight text-white sm:text-[42px] lg:text-[86px]"
              style={{
                fontWeight: 700,
                margin: '0 0 16px',
              }}
            >
              Occasion
              <span className="block" style={{ color: 'hsl(41 58% 58%)' }}>Packages</span>
            </h1>
            <p className="max-w-[470px] text-[16px] font-semibold leading-7 text-[hsl(37_35%_94%)] sm:text-[18px] lg:text-[20px]">
              Curated catering menus for family celebrations, gatherings, and events.
            </p>

            <div className="mt-6 grid max-w-[600px] grid-cols-1 gap-2.5 lg:grid-cols-4">
              {HERO_FEATURES.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-[18px] border border-white/10 bg-black/10 px-3 py-2 text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)]"
                >
                  <Icon className="h-[19px] w-[19px] shrink-0 text-[hsl(41_58%_60%)]" strokeWidth={2} />
                  <span className="text-[12.5px] font-extrabold leading-[1.15]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 max-w-[840px] rounded-br-[22px] rounded-tr-[22px] border border-[hsl(35_24%_84%)] bg-[hsl(39_50%_97%)] px-4 py-[18px] shadow-[0_14px_34px_rgba(33,18,12,0.13)] sm:px-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              {TRUST_STRIP.map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-[13px] font-bold leading-snug text-[hsl(20_24%_18%)]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-[hsl(37_38%_92%)]">
                    <Icon className="h-5 w-5 text-[hsl(31_28%_43%)]" strokeWidth={2.15} />
                  </span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════ CHOOSE PACKAGE ══════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 pb-2 pt-6 sm:px-6 lg:px-8 lg:pt-7">
        <div className="mb-5 text-center">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 8 }}>
            <span style={{ width: 30, height: 1, background: 'hsla(41, 56%, 52%, 0.46)', flexShrink: 0 }} />
            <h2 style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 'clamp(23px,3vw,32px)', color: 'hsl(0 0% 12%)', margin: 0, textAlign: 'center' }}>
              Find the right menu for your celebration
            </h2>
            <span style={{ width: 30, height: 1, background: 'hsla(41, 56%, 52%, 0.46)', flexShrink: 0 }} />
          </div>
          <p className="mx-auto max-w-2xl text-sm leading-5 text-[hsl(0_0%_42%)] sm:text-[15px]">
            Explore curated packages for poojas, birthdays, corporate meals, house gatherings, and large events.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-4">
          {PKG_CARDS.map((pkg) => {
            const apiPkg = getApiPkg(pkg);
            const isExpanded = !!(apiPkg && expandedId === apiPkg.id);
            const canExpand = !!(apiPkg?.activeVersion);
            const activeVersion = apiPkg?.activeVersion;
            const guestRange = activeVersion
              ? `${activeVersion.minGuestCount}-${activeVersion.maxGuestCount ?? '1000'} guests`
              : pkg.serves;
            const startingPrice = activeVersion?.basePricePerPlate;
            const menuSummary = pkg.isBuild ? 'Custom menu selection' : `${pkg.includes.length} menu highlights`;

            return (
              <div
                key={pkg.name}
                className="group flex overflow-hidden rounded-[18px] border border-[hsl(35_22%_86%)] bg-white shadow-[0_7px_20px_rgba(45,31,20,0.045)] transition-all duration-[250ms] [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:border-[hsla(41,56%,52%,0.42)] hover:shadow-[0_14px_30px_rgba(45,31,20,0.075)]"
                style={{
                  flexDirection: 'column',
                }}
              >
                {/* image */}
                <div className="relative h-[160px] shrink-0 overflow-hidden sm:h-[168px]">
                  <img
                    src={pkg.image}
                    alt={pkg.name}
                    className="block h-full w-full object-cover transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.045]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-80" />
                  {pkg.badge && (
                    <span className="absolute right-4 top-4 rounded-full border border-[hsla(41,56%,66%,0.55)] bg-[hsla(352,59%,22%,0.88)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[hsl(41_70%_72%)] shadow-sm">
                      {pkg.badge}
                    </span>
                  )}
                  <div
                    style={{
                      position: 'absolute', left: 16, bottom: -18,
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'hsl(352 59% 28%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 8px 18px rgba(45,31,20,0.15)',
                      border: '1px solid hsla(41,56%,60%,0.34)',
                    }}
                  >
                    {pkg.isBuild
                      ? <ArrowLeftRight style={{ width: 18, height: 18, color: 'hsl(41 58% 66%)' }} strokeWidth={2.3} />
                      : <Check style={{ width: 20, height: 20, color: 'hsl(41 58% 66%)' }} strokeWidth={2.8} />}
                  </div>
                </div>

                {/* body */}
                <div className="flex flex-col bg-white px-4 pb-4 pt-6">
                  <h3 style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 20, margin: '0 0 6px', color: 'hsl(0 0% 12%)', lineHeight: 1.12 }}>
                    {pkg.name}
                  </h3>
                  <p className="mb-3 line-clamp-2 text-[13px] leading-[1.42] text-[hsl(0_0%_40%)]">
                    {pkg.desc}
                  </p>

                  <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-[14px] border border-[hsl(35_22%_88%)] bg-[hsl(39_50%_98%)]">
                    <div className="border-r border-[hsl(35_22%_88%)] px-3 py-2">
                      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[hsl(0_0%_46%)]">From</div>
                      <div className="mt-0.5 font-serif text-[18px] font-bold leading-none text-[hsl(352_59%_30%)]">
                        {startingPrice ? `₹${startingPrice}` : 'On request'}
                      </div>
                      {startingPrice && <div className="mt-0.5 text-[10.5px] font-semibold text-[hsl(0_0%_48%)]">per guest</div>}
                    </div>
                    <div className="px-3 py-2">
                      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[hsl(0_0%_46%)]">Serves</div>
                      <div className="mt-0.5 text-[13px] font-extrabold leading-snug text-[hsl(0_0%_18%)]">
                        {guestRange ?? 'Flexible group size'}
                      </div>
                    </div>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-extrabold text-[hsl(0_0%_30%)]">
                    <span>Includes</span>
                    <span className="rounded-full bg-[hsl(41_55%_94%)] px-2 py-0.5 text-[10.5px] text-[hsl(38_52%_34%)]">{menuSummary}</span>
                  </div>

                  <div className="mb-4 flex flex-col gap-1.5">
                    {pkg.includes.slice(0, 4).map((item) => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Check
                          style={{ width: 15, height: 15, flexShrink: 0, color: pkg.isBuild ? 'hsl(140 50% 38%)' : 'hsl(352 59% 38%)' }}
                          strokeWidth={2.6}
                        />
                        <span style={{ fontSize: 13, color: 'hsl(0 0% 26%)', lineHeight: 1.25 }}>{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {pkg.isBuild ? (
                    <Link
                      href={pkg.href}
                      aria-label={`Build a custom package for ${pkg.name}`}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[hsl(352_59%_30%)] bg-[hsl(352_59%_30%)] px-4 text-[13.5px] font-extrabold text-white no-underline shadow-[0_7px_15px_rgba(116,28,42,0.12)] transition-all duration-[250ms] [font-family:'Nunito_Sans',sans-serif] [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:bg-[hsl(352_59%_26%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-2"
                    >
                      Build Your Package
                      <ArrowRight style={{ width: 15, height: 15 }} />
                    </Link>
                  ) : (
                    <div className="grid gap-2">
                      <button
                        onClick={() => canExpand && toggleDetails(apiPkg!)}
                        disabled={!canExpand}
                        aria-expanded={isExpanded}
                        aria-label={`View menu for ${pkg.name}`}
                        className={cn(
                          "flex h-10 w-full items-center justify-center gap-2 rounded-full border px-4 text-[13px] font-extrabold shadow-[0_5px_13px_rgba(116,28,42,0.07)] transition-all duration-[250ms] [font-family:'Nunito_Sans',sans-serif] [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50",
                          isExpanded
                            ? 'border-[hsl(352_59%_30%)] bg-[hsl(352_59%_30%)] text-white'
                            : 'border-[hsla(352,59%,30%,0.42)] bg-white text-[hsl(352_59%_30%)] hover:border-[hsl(352_59%_30%)] hover:bg-[hsl(352_48%_97%)]',
                        )}
                        style={{
                          cursor: canExpand ? 'pointer' : 'default',
                        }}
                      >
                        View menu
                        <ArrowRight style={{ width: 14, height: 14 }} />
                      </button>
                      <Link
                        href={apiPkg ? `/packages/${apiPkg.id}` : pkg.href}
                        aria-label={`Choose ${pkg.name}`}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[hsl(352_59%_30%)] bg-[hsl(352_59%_30%)] px-4 text-[13px] font-extrabold text-white no-underline shadow-[0_7px_15px_rgba(116,28,42,0.12)] transition-all duration-[250ms] [font-family:'Nunito_Sans',sans-serif] [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:bg-[hsl(352_59%_26%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-2"
                      >
                        Choose Package
                        <ArrowRight style={{ width: 14, height: 14 }} />
                      </Link>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════ MENU DRAWER ══════════════════════════ */}
      {selectedApiPkg && selectedCard && (
        <div
          className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedCard.name} menu`}
          onClick={closeDetails}
        >
          <aside
            className="ml-auto flex h-full w-full flex-col overflow-y-auto bg-[hsl(39_50%_98%)] shadow-[-18px_0_45px_rgba(45,31,20,0.18)] sm:max-w-[500px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[hsl(35_22%_86%)] bg-[hsl(39_55%_97%)] px-5 py-5 sm:px-6">
              <div>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[hsl(38_52%_38%)]">
                  Package menu
                </div>
                <h3 className="m-0 font-serif text-[26px] font-bold leading-tight text-[hsl(0_0%_12%)]">
                  {selectedCard.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                aria-label="Close menu"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[hsl(35_22%_84%)] bg-white text-[hsl(0_0%_18%)] shadow-sm transition-colors hover:border-[hsl(352_38%_72%)] hover:text-[hsl(352_59%_30%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 sm:px-6">
              <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-[16px] border border-[hsl(35_22%_86%)] bg-white shadow-[0_8px_22px_rgba(45,31,20,0.055)]">
                <div className="border-r border-[hsl(35_22%_88%)] px-4 py-3">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[hsl(0_0%_46%)]">From</div>
                  <div className="mt-1 font-serif text-[22px] font-bold leading-none text-[hsl(352_59%_30%)]">
                    {selectedStartingPrice ? `₹${selectedStartingPrice}` : 'On request'}
                  </div>
                  {selectedStartingPrice && <div className="mt-1 text-[11px] font-semibold text-[hsl(0_0%_48%)]">per guest</div>}
                </div>
                <div className="px-4 py-3">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[hsl(0_0%_46%)]">Serves</div>
                  <div className="mt-1 text-[14px] font-extrabold leading-snug text-[hsl(0_0%_18%)]">
                    {selectedGuestRange ?? 'Flexible group size'}
                  </div>
                </div>
              </div>

              <p className="mb-4 text-[13.5px] leading-5 text-[hsl(0_0%_34%)]">
                {selectedCard.desc}
              </p>

              {loadingId === selectedApiPkg.id ? (
                <div className="rounded-[16px] border border-[hsl(35_22%_86%)] bg-white px-4 py-8 text-center text-sm font-semibold text-[hsl(0_0%_48%)]">
                  Loading package details...
                </div>
              ) : selectedConfig ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[hsl(0_0%_36%)]">
                      {selectedConfig.isCustom ? 'Full menu' : selectedConfig.categoryRules[0]?.isMandatory ? 'Included items' : 'Menu highlights'}
                    </div>
                    {hasSwappableItems(selectedConfig) && (
                      <span className="rounded-full bg-[hsl(41_55%_93%)] px-3 py-1 text-[11px] font-extrabold text-[hsl(38_52%_34%)]">
                        Swap available
                      </span>
                    )}
                  </div>

                  <div className="rounded-[16px] border border-[hsl(35_22%_86%)] bg-white p-2 shadow-[0_8px_22px_rgba(45,31,20,0.045)]">
                    <div className="space-y-1">
                      {getMenuHighlightRows(selectedConfig, selectedApiPkg.id).map(({ rule, item, idx, swapKey, canSwap }) => {
                        const isSwapOpen = swapOpen === swapKey;
                        const displayedIds = canSwap ? getDisplayedIds(rule, selectedApiPkg.id) : new Set<string>();
                        const alternatives = canSwap
                          ? (swapAlts[rule.category.id] ?? []).filter((a) => !displayedIds.has(a.id))
                          : [];

                        return (
                          <div key={swapKey}>
                            <div
                              className={cn(
                                'flex min-h-[36px] items-center gap-2 rounded-[10px] border px-2.5 py-1.5 transition-colors',
                                isSwapOpen
                                  ? 'border-[hsl(352_38%_78%)] bg-[hsl(352_42%_98%)]'
                                  : 'border-[hsl(35_22%_90%)] bg-[hsl(39_52%_99%)]',
                              )}
                            >
                              <VegDot isVeg={item.isVeg} />
                              <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold leading-5 text-[hsl(0_0%_16%)]" title={item.name}>
                                {item.name}
                              </span>
                              {canSwap && (
                                <button
                                  type="button"
                                  onClick={() => openSwap(swapKey, rule.category.id)}
                                  aria-label={`Swap ${item.name}`}
                                  className={cn(
                                    'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[10.5px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-1',
                                    isSwapOpen
                                      ? 'border-[hsl(352_59%_30%)] bg-[hsl(352_59%_30%)] text-white'
                                      : 'border-[hsl(352_36%_70%)] bg-white text-[hsl(352_59%_30%)] hover:bg-[hsl(352_48%_97%)]',
                                  )}
                                >
                                  <ArrowLeftRight className="h-3 w-3" />
                                  Swap
                                </button>
                              )}
                            </div>

                            {isSwapOpen && (
                              <div className="mt-1 rounded-[12px] border border-[hsl(35_22%_88%)] bg-white p-1.5 shadow-[0_8px_18px_rgba(45,31,20,0.07)]">
                                <div className="px-1 pb-1 text-[10.5px] font-bold text-[hsl(0_0%_44%)]">Swap with</div>
                                {swapLoading ? (
                                  <div className="px-1 py-1.5 text-[12px] font-semibold text-[hsl(0_0%_52%)]">Loading...</div>
                                ) : alternatives.length === 0 ? (
                                  <div className="px-1 py-1.5 text-[12px] font-semibold text-[hsl(0_0%_52%)]">No other options available</div>
                                ) : (
                                  <div className="grid gap-1 sm:grid-cols-2">
                                    {alternatives.map((alt) => (
                                      <button
                                        key={alt.id}
                                        type="button"
                                        onClick={() => handleSwap(selectedApiPkg.id, rule, idx, alt)}
                                        className="flex min-h-[32px] w-full items-center gap-2 rounded-[9px] px-2 py-1 text-left transition-colors hover:bg-[hsl(352_48%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-1"
                                      >
                                        <VegDot isVeg={alt.isVeg} />
                                        <span className="min-w-0 flex-1 truncate text-[12px] font-bold leading-5 text-[hsl(0_0%_18%)]">
                                          {alt.name}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[16px] border border-[hsl(35_22%_86%)] bg-white px-4 py-8 text-center text-sm font-semibold text-[hsl(0_0%_48%)]">
                  Details unavailable.
                </div>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-[hsl(35_22%_86%)] bg-[hsl(39_55%_97%)] px-5 py-4 shadow-[0_-10px_24px_rgba(45,31,20,0.08)] sm:px-6">
              {selectedConfig ? (
                <Link
                  href={`/packages/${selectedConfig.packageId}`}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[hsl(352_59%_30%)] px-5 text-[14px] font-extrabold text-white no-underline shadow-[0_8px_18px_rgba(116,28,42,0.16)] transition-colors hover:bg-[hsl(352_59%_26%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-2"
                >
                  Choose Package
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex h-12 w-full cursor-default items-center justify-center gap-2 rounded-full bg-[hsl(352_18%_54%)] px-5 text-[14px] font-extrabold text-white opacity-80"
                >
                  Choose Package
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-2 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <div className="mb-6 flex items-center justify-center gap-3 sm:gap-[18px]">
          <span className="h-0.5 w-8 shrink-0 bg-[hsl(41_56%_55%)] sm:w-[42px]" />
          <h2 style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 28, color: 'hsl(0 0% 12%)', margin: 0 }}>
            Compare Packages
          </h2>
          <span className="h-0.5 w-8 shrink-0 bg-[hsl(41_56%_55%)] sm:w-[42px]" />
        </div>

        <div style={{ background: '#fff', border: '1px solid hsl(35 22% 88%)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ background: 'hsl(37 30% 95%)' }}>
                  <th style={{ textAlign: 'left', padding: '17px 22px', fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', color: 'hsl(0 0% 30%)', width: '22%' }}>
                    INCLUDES
                  </th>
                  {COMPARE_COLS.map((col) => (
                    <th
                      key={col.label}
                      style={{ textAlign: 'center', padding: '17px 14px', fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1.3, color: col.color }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} style={{ background: row.highlight ? 'hsl(37 30% 96%)' : '#fff' }}>
                    <td style={{ padding: '15px 22px', fontSize: 14, fontWeight: 700, color: 'hsl(0 0% 25%)', borderTop: '1px solid hsl(35 22% 91%)' }}>
                      {row.label}
                    </td>
                    {row.cells.map((cell, i) => (
                      <td key={i} style={{ textAlign: 'center', padding: '15px 14px', borderTop: '1px solid hsl(35 22% 91%)' }}>
                        <CellValue cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════════════ BOTTOM FEATURES ══════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div
          className="grid grid-cols-1 gap-3 lg:grid-cols-4"
          style={{
            background: 'linear-gradient(180deg, hsl(41 45% 95%), hsl(39 44% 97%))',
            border: '1px solid hsl(35 22% 88%)',
            borderRadius: 16, padding: '26px 14px',
          }}
        >
          {BOTTOM_FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px',
                borderLeft: 'none',
              }}
            >
              <div
                style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: 'hsl(352 40% 94%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: 'hsl(352 59% 30%)',
                  fontSize: 24,
                }}
              >
                {['🍽', '⏱', '✓', '🌿'][i]}
              </div>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'hsl(0 0% 15%)' }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'hsl(0 0% 48%)' }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
