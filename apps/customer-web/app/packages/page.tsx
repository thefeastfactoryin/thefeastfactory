'use client';

import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock3,
  Headphones,
  IndianRupee,
  ShieldCheck,
  Users,
  Utensils,
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

  function getDisplayItems(rule: PackageConfiguration['categoryRules'][number], pkgId: string): PkgItem[] {
    const count = Math.min(rule.maxSelections, rule.items.length);
    return Array.from({ length: count }, (_, i) => swappedItems[`${pkgId}:${rule.id}:${i}`] ?? rule.items[i]!);
  }

  function getDisplayedIds(rule: PackageConfiguration['categoryRules'][number], pkgId: string): Set<string> {
    return new Set(getDisplayItems(rule, pkgId).map((i) => i.id));
  }

  async function openSwap(swapKey: string, categoryId: string, displayedIds: Set<string>) {
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

  function handleSwap(pkgId: string, ruleId: string, position: number, alt: MenuItem) {
    const asItem: PkgItem = {
      ...alt,
      isSwappable: true,
      basePrice: '0.00',
      boxPrice: '0.00',
      generalPrice: '0.00',
      itemPrice: '0.00',
      includedValue: '0.00',
      adjustmentAmount: '0.00',
    };
    setSwappedItems((prev) => ({ ...prev, [`${pkgId}:${ruleId}:${position}`]: asItem }));
    setSwapOpen(null);
  }

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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {PKG_CARDS.map((pkg) => {
            const apiPkg = getApiPkg(pkg);
            const isExpanded = !!(apiPkg && expandedId === apiPkg.id);
            const isLoading = !!(apiPkg && loadingId === apiPkg.id);
            const config = apiPkg ? configs[apiPkg.id] : undefined;
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
                <div className="flex flex-1 flex-col bg-white px-4 pb-4 pt-6">
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
                      className="mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[hsl(352_59%_30%)] bg-[hsl(352_59%_30%)] px-4 text-[13.5px] font-extrabold text-white no-underline shadow-[0_7px_15px_rgba(116,28,42,0.12)] transition-all duration-[250ms] [font-family:'Nunito_Sans',sans-serif] [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:bg-[hsl(352_59%_26%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-2"
                    >
                      Build Your Package
                      <ArrowRight style={{ width: 15, height: 15 }} />
                    </Link>
                  ) : (
                    <button
                      onClick={() => canExpand && toggleDetails(apiPkg!)}
                      disabled={!canExpand}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Hide menu for' : 'View menu for'} ${pkg.name}`}
                      className={cn(
                        "mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-[13.5px] font-extrabold shadow-[0_5px_13px_rgba(116,28,42,0.07)] transition-all duration-[250ms] [font-family:'Nunito_Sans',sans-serif] [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50",
                        isExpanded
                          ? 'border-[hsl(352_59%_30%)] bg-[hsl(352_59%_30%)] text-white'
                          : 'border-[hsla(352,59%,30%,0.42)] bg-white text-[hsl(352_59%_30%)] hover:border-[hsl(352_59%_30%)] hover:bg-[hsl(352_48%_97%)]',
                      )}
                      style={{
                        cursor: canExpand ? 'pointer' : 'default',
                      }}
                    >
                      {isExpanded ? 'Hide menu' : 'View menu'}
                      {isExpanded
                        ? <ChevronUp style={{ width: 15, height: 15 }} />
                        : <ChevronDown style={{ width: 15, height: 15 }} />}
                    </button>
                  )}
                </div>

                {/* ── Expanded details panel ── */}
                {isExpanded && (
                  <div className="transition-all duration-200" style={{ background: 'hsl(39 44% 97%)', borderTop: '1px solid hsl(35 22% 88%)', padding: 16 }}>
                    {isLoading ? (
                      <div style={{ textAlign: 'center', padding: '18px 0', color: 'hsl(0 0% 48%)', fontSize: 14 }}>
                        Loading package details…
                      </div>
                    ) : config ? (
                      <>
                        <div style={{
                          fontSize: 11, fontWeight: 800, letterSpacing: '0.07em',
                          color: 'hsl(0 0% 38%)', textTransform: 'uppercase', marginBottom: 10,
                        }}>
                          {config.isCustom ? 'Full Menu' : config.categoryRules[0]?.isMandatory ? 'Included Items' : 'Menu Highlights'}
                        </div>

                        <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          {config.categoryRules.flatMap((rule) => {
                            const displayItems = getDisplayItems(rule, apiPkg!.id);
                            return displayItems.map((item, idx) => {
                              const swapKey = `${apiPkg!.id}:${rule.id}:${idx}`;
                              const isSwapOpen = swapOpen === swapKey;
                              const displayedIds = item.isSwappable ? getDisplayedIds(rule, apiPkg!.id) : new Set<string>();
                              const alternatives = item.isSwappable
                                ? (swapAlts[rule.category.id] ?? []).filter((a) => !displayedIds.has(a.id))
                                : [];

                              return (
                                <div key={swapKey} className={cn('min-w-0', isSwapOpen && 'sm:col-span-2')}>
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    minHeight: 34,
                                    background: isSwapOpen ? 'hsl(352 42% 98%)' : '#fff', borderRadius: 8, padding: '4px 8px',
                                    border: `1px solid ${isSwapOpen ? 'hsl(352 38% 82%)' : 'hsl(35 22% 90%)'}`,
                                    transition: 'border-color 0.15s',
                                  }}>
                                    <VegDot isVeg={item.isVeg} />
                                    <span
                                      className="min-w-0 truncate"
                                      style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'hsl(0 0% 16%)', lineHeight: 1.3 }}
                                      title={item.name}
                                    >
                                      {item.name}
                                    </span>
                                    {item.isSwappable && (
                                      <button
                                        onClick={() => openSwap(swapKey, rule.category.id, displayedIds)}
                                        aria-label={`Swap ${item.name}`}
                                        title={`Swap ${item.name}`}
                                        className="transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-1"
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          width: 28, height: 28,
                                          fontSize: 11, fontWeight: 800,
                                          color: isSwapOpen ? '#fff' : 'hsl(352 59% 30%)',
                                          background: isSwapOpen ? 'hsl(352 59% 30%)' : 'hsl(352 44% 97%)',
                                          border: '1px solid hsl(352 42% 78%)',
                                          borderRadius: 999, padding: 0,
                                          cursor: 'pointer', flexShrink: 0,
                                        }}
                                      >
                                        <ArrowLeftRight style={{ width: 12, height: 12 }} />
                                      </button>
                                    )}
                                  </div>

                                  {isSwapOpen && (
                                    <div style={{
                                      marginTop: 3,
                                      background: '#fff',
                                      border: '1px solid hsl(35 22% 88%)',
                                      borderRadius: 8, padding: '6px',
                                      boxShadow: '0 6px 16px rgba(45,31,20,0.07)',
                                    }}>
                                      <div style={{
                                        fontSize: 11, fontWeight: 700, color: 'hsl(0 0% 44%)',
                                        marginBottom: 6, padding: '0 4px',
                                      }}>
                                        Swap with:
                                      </div>
                                      {swapLoading ? (
                                        <div style={{ fontSize: 12, color: 'hsl(0 0% 52%)', padding: '6px 4px' }}>Loading…</div>
                                      ) : alternatives.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'hsl(0 0% 52%)', padding: '6px 4px' }}>No other options available</div>
                                      ) : (
                                        <div className="grid gap-1 sm:grid-cols-2">
                                          {alternatives.map((alt) => (
                                            <button
                                              key={alt.id}
                                              onClick={() => handleSwap(apiPkg!.id, rule.id, idx, alt)}
                                              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-1"
                                              style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                minHeight: 34, padding: '6px 8px', borderRadius: 7, width: '100%',
                                                border: 'none', background: 'transparent',
                                                cursor: 'pointer', textAlign: 'left',
                                              }}
                                              onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(352 59% 97%)')}
                                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                            >
                                              <VegDot isVeg={alt.isVeg} />
                                              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'hsl(0 0% 18%)' }}>
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
                            });
                          })}
                        </div>

                        {/* Footer: pricing + choose CTA */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          flexWrap: 'wrap', gap: 10,
                          marginTop: 16, paddingTop: 14,
                          borderTop: '1px solid hsl(35 22% 88%)',
                        }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'hsl(0 0% 48%)', fontWeight: 600 }}>Starting from</div>
                            <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 800, fontSize: 18, color: 'hsl(352 59% 30%)' }}>
                              ₹{config.basePricePerPlate}
                              <span style={{ fontFamily: "'Nunito Sans', sans-serif", fontSize: 12, fontWeight: 600, color: 'hsl(0 0% 48%)' }}> /person</span>
                            </div>
                          </div>
                          <Link
                            href={`/packages/${config.packageId}`}
                            className="transition-colors duration-200 hover:bg-[hsl(352_59%_26%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(41_56%_56%)] focus-visible:ring-offset-2"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              background: 'hsl(352 59% 30%)', color: '#fff',
                              minHeight: 44, borderRadius: 999, padding: '10px 16px',
                              fontFamily: "'Nunito Sans', sans-serif", fontWeight: 800, fontSize: 13,
                              textDecoration: 'none',
                            }}
                          >
                            Choose Package
                            <ArrowRight style={{ width: 13, height: 13 }} />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: 'hsl(0 0% 48%)', fontSize: 14 }}>
                        Details unavailable.{' '}
                        <Link href={pkg.href} style={{ color: 'hsl(352 59% 30%)', fontWeight: 700 }}>
                          View package →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════ COMPARE TABLE ══════════════════════════ */}
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
