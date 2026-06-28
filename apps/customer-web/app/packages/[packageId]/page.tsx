'use client';

import type { PackageConfiguration } from '@aranyam/shared-types';
import {
  ArrowLeft,
  ChefHat,
  CheckCircle2,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OrderProgress } from '../../../components/order-progress';
import { Button } from '../../../components/ui/button';
import { StatePanel } from '../../../components/ui/state-panel';
import { apiRequest } from '../../../lib/api';
import { useOrderBuilderStore } from '../../../store/order-builder.store';
import { useSessionStore } from '../../../store/session.store';
import { cn } from '../../../lib/utils';

export default function PackagePage() {
  const { packageId } = useParams<{ packageId: string }>();
  const router = useRouter();
  const setPackage = useOrderBuilderStore((s) => s.setPackage);
  const setDbCartId = useOrderBuilderStore((s) => s.setDbCartId);
  const session = useSessionStore((s) => s.session);
  const [version, setVersion] = useState<
    (PackageConfiguration & { packageName: string }) | null
  >(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<any>(`/packages/${packageId}/active-version`)
      .then(async (activeVersion) => {
        const configuration = await apiRequest<PackageConfiguration>(
          `/package-versions/${activeVersion.id}/configuration`,
        );
        setVersion(configuration);
      })
      .catch((reason) => setError(reason.message));
  }, [packageId]);

  async function startOrder() {
    if (!version) return;
    setPackage({
      packageId,
      packageVersionId: version.id,
      packageName: version.packageName,
      packageType: version.packageType,
      isCustom: version.isCustom,
      basePricePerPlate: version.basePricePerPlate,
      minGuestCount: version.minGuestCount,
      maxGuestCount: version.maxGuestCount,
    });
    if (session) {
      const cart = await apiRequest<{ id: string }>('/cart', { method: 'PUT', body: JSON.stringify({ packageVersionId: version.id }) }, session.accessToken);
      setDbCartId(cart.id);
    }
    router.push('/menu/select');
  }

  if (error)
    return (
      <main className="page-shell">
        <StatePanel
          tone="danger"
          title="Package could not load"
          description={error}
          actionHref="/packages"
          actionLabel="Back to packages"
        />
      </main>
    );

  if (!version)
    return (
      <main className="page-shell">
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </main>
    );

  return (
    <main className="pb-28">
      {/* ── Maroon header ── */}
      <div className="bg-primary">
        <div className="container-pad py-8 sm:py-10">
          <Link
            href="/packages"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> All packages
          </Link>
          <div className="mt-5 mb-6">
            <OrderProgress current={0} />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {version.isCustom ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    <ChefHat className="h-3 w-3" /> Build Your Own
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    <Sparkles className="h-3 w-3" /> Occasion Package
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {version.packageName}
              </h1>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white/70">
                <Users className="h-4 w-4" />
                {version.minGuestCount}–{version.maxGuestCount ?? '1,000'} guests
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-pad py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* ── Course rules ── */}
          <section>
            <h2 className="text-lg font-extrabold">
              {version.isCustom ? 'Available dish categories' : 'Package courses'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {version.isCustom
                ? 'You can pick any dish from any category. Pricing is per item, per person.'
                : 'Select the exact number of dishes within each course. Premium dishes are priced at a small addition.'}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {version.categoryRules.map((rule, idx) => (
                <div key={rule.id} className="surface-card flex gap-4 p-5">
                  <span
                    className={cn(
                      'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold',
                      idx % 2 === 0
                        ? 'bg-primary/10 text-primary'
                        : 'bg-accent/15 text-accent-foreground',
                    )}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold">{rule.category.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {version.isCustom
                        ? `${rule.items.length} dishes available — item pricing`
                        : `Choose ${
                            rule.minSelections === rule.maxSelections
                              ? rule.minSelections
                              : `${rule.minSelections}–${rule.maxSelections}`
                          } from ${rule.items.length} dishes`}
                    </p>
                    {!version.isCustom && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {rule.items.slice(0, 3).map((item) => (
                          <span key={item.id} className="tag-chip">
                            {item.name}
                          </span>
                        ))}
                        {rule.items.length > 3 && (
                          <span className="tag-chip">+{rule.items.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* What happens next */}
            <div className="mt-8 surface-inset p-5">
              <p className="text-sm font-extrabold">What happens next</p>
              <div className="mt-4 space-y-3">
                {[
                  'Enter your event date, venue, and guest count',
                  version.isCustom
                    ? 'Browse the full menu and add exactly the dishes you want'
                    : 'Curate your menu within each course category',
                  'Review your cart and pay securely',
                  'Track your order from kitchen to venue',
                ].map((step, i) => (
                  <div key={step} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-extrabold text-primary">
                      {i + 1}
                    </span>
                    <p className="text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Pricing sidebar ── */}
          <aside>
            <div className="surface-card p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-2">
                {version.isCustom ? (
                  <ChefHat className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                )}
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {version.isCustom ? 'Custom pricing' : 'Package pricing'}
                </p>
              </div>

              <div className="mt-4">
                {version.isCustom ? (
                  <>
                    <p className="text-3xl font-extrabold text-primary">Item-based</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Price varies by your chosen dishes. Total shown per plate at checkout.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-extrabold text-primary">
                      ₹{version.basePricePerPlate}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      per person, base price. Premium dish upgrades shown during menu build.
                    </p>
                  </>
                )}
              </div>

              <div className="my-5 h-px bg-border" />

              <ul className="space-y-3">
                {[
                  `${version.categoryRules.length} dish categories`,
                  `${version.minGuestCount}–${version.maxGuestCount ?? '1,000'} guests`,
                  version.isCustom
                    ? 'Item-level transparent pricing'
                    : 'Live price updates on upgrades',
                  '48-hour minimum lead time',
                  'Delivery to your venue included',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="my-5 h-px bg-border" />

              <p className="text-xs leading-5 text-muted-foreground">
                {version.isCustom
                  ? 'Next, add event details. Then browse every dish and build your menu at item-level prices.'
                  : 'Next, add event details. Then curate each course within the package limits.'}
              </p>

              <Button className="mt-5 w-full rounded-full" size="lg" onClick={startOrder}>
                Choose this package
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                No payment now — review pricing before checkout.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
