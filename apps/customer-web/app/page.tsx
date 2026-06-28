'use client';

import type { OrderingOffering, PackageConfiguration, PackageSummary } from '@aranyam/shared-types';
import { ArrowRight, Check, Clock, CreditCard, MessageCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { catalogCopy, offeringDisplay, packageImage } from '../lib/catalog-display';
import { apiRequest } from '../lib/api';

const trustIcons = [Users, Clock, CreditCard, MessageCircle];

export default function HomePage() {
  const [offerings, setOfferings] = useState<OrderingOffering[]>([]);
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [configs, setConfigs] = useState<Record<string, PackageConfiguration>>({});
  useEffect(() => {
    Promise.all([
      apiRequest<OrderingOffering[]>('/catalog/ordering-offerings'),
      apiRequest<PackageSummary[]>('/packages'),
    ]).then(async ([nextOfferings, rows]) => {
      setOfferings(nextOfferings);
      const featured = rows.filter((row) => row.isFeatured && row.activeVersion).sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999)).slice(0, 4);
      setPackages(featured);
      const details = await Promise.all(featured.map(async (pkg) => [pkg.id, await apiRequest<PackageConfiguration>(`/package-versions/${pkg.activeVersion!.id}/configuration`)] as const));
      setConfigs(Object.fromEntries(details));
    }).catch(() => {});
  }, []);

  return <main className="bg-background">
    <section className="bg-[hsl(352_59%_18%)] text-white">
      <div className="mx-auto grid max-w-7xl gap-9 px-4 py-12 sm:px-6 md:grid-cols-2 md:items-center lg:px-8">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-white/65">The Feast Factory</p><h1 className="mt-4 font-serif text-4xl font-bold leading-tight sm:text-6xl">Premium food for every gathering.</h1><p className="mt-5 max-w-xl text-base leading-7 text-white/75">Bulk catering for groups of 20 to 1,000. Choose a complete meal box, a curated package, or build your own menu.</p><Link href="/packages" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[hsl(41_56%_48%)] px-6 py-3 text-sm font-bold text-white">Explore packages <ArrowRight className="h-4 w-4" /></Link></div>
        <img src="/Hero.png" alt="Fresh catering dishes ready to serve" className="hidden max-h-[360px] w-full rounded-2xl object-cover shadow-2xl md:block" />
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><h2 className="text-center font-serif text-3xl font-bold">Choose how you want to order</h2><div className="mt-8 grid gap-5 md:grid-cols-3">{offerings.map((offering) => {
      const display = offeringDisplay[offering.code];
      return <Link key={offering.id} href={display.href} className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><img src={display.image} alt="" className="h-44 w-full object-cover" /><div className="p-5"><h3 className="font-serif text-2xl font-bold">{offering.title}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{offering.description}</p><span className="mt-4 flex items-center gap-2 text-sm font-bold text-primary">Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></Link>;
    })}</div></section>

    <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Featured</p><h2 className="mt-2 font-serif text-3xl font-bold">Popular packages</h2></div><Link href="/packages" className="text-sm font-bold text-primary">View all</Link></div><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{packages.map((pkg) => {
      const version = pkg.activeVersion!;
      const includes = configs[pkg.id]?.categoryRules.slice(0, 3) ?? [];
      return <Link key={pkg.id} href={`/packages/${pkg.id}`} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><img src={packageImage(pkg.name, pkg.type)} alt="" className="h-36 w-full object-cover" /><div className="p-4"><h3 className="font-serif text-xl font-bold">{pkg.name}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{pkg.description}</p><div className="mt-3 space-y-1">{includes.map((rule) => <p key={rule.id} className="flex items-center gap-2 text-xs"><Check className="h-3 w-3 text-emerald-600" />{rule.category.name}</p>)}</div><p className="mt-4 font-bold text-primary">From ₹{version.basePricePerPlate}<span className="text-xs font-normal text-muted-foreground"> / person</span></p></div></Link>;
    })}</div></section>

    <section className="border-y bg-white"><div className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">{catalogCopy.trust.map(([title, desc], index) => { const Icon = trustIcons[index]!; return <div key={title} className="border-border p-5 lg:border-r last:border-r-0"><Icon className="h-5 w-5 text-primary" /><h3 className="mt-2 text-sm font-bold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{desc}</p></div>; })}</div></section>
  </main>;
}
