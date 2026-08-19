'use client';

import Switch from '@mui/material/Switch';
import type { OperatingRegion, OrderingOffering } from '@aranyam/shared-types';
import { Home, ImagePlus, MapPin, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaUploader } from '../../../components/media-uploader';
import { Field, Textarea } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { resolveMediaUrl } from '../../../lib/media-url';
import { useAdminSessionStore } from '../../../store/session.store';

export default function AdminHomepage() {
  const session = useAdminSessionStore((state) => state.session);
  const [offerings, setOfferings] = useState<OrderingOffering[]>([]);
  const [regions, setRegions] = useState<OperatingRegion[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiRequest<OrderingOffering[]>(
        '/admin/catalog/ordering-offerings',
        {},
        session.accessToken,
      ),
      apiRequest<OperatingRegion[]>(
        '/admin/operating-regions',
        {},
        session.accessToken,
      ),
    ])
      .then(([nextOfferings, nextRegions]) => {
        setOfferings(nextOfferings);
        setRegions(nextRegions);
      })
      .catch((reason) => setError((reason as Error).message));
  }, [session]);

  async function updateOffering(
    offering: OrderingOffering,
    changes: Partial<OrderingOffering>,
  ) {
    if (!session) return;
    setError('');
    try {
      const updated = await apiRequest<OrderingOffering>(
        `/admin/catalog/ordering-offerings/${offering.code}`,
        { method: 'PATCH', body: JSON.stringify(changes) },
        session.accessToken,
      );
      setOfferings((rows) =>
        rows
          .map((row) => (row.code === updated.code ? updated : row))
          .sort((a, b) => a.displayOrder - b.displayOrder),
      );
      setMessage(`${updated.title} updated.`);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function updateRegion(
    region: OperatingRegion,
    changes: Partial<OperatingRegion>,
  ) {
    if (!session) return;
    setError('');
    try {
      const updated = await apiRequest<OperatingRegion>(
        `/admin/operating-regions/${region.id}`,
        { method: 'PATCH', body: JSON.stringify(changes) },
        session.accessToken,
      );
      setRegions((rows) =>
        rows
          .map((row) => (row.id === updated.id ? updated : row))
          .sort(
            (a, b) =>
              a.publicDisplayOrder - b.publicDisplayOrder ||
              a.name.localeCompare(b.name),
          ),
      );
      setMessage(`${updated.name} kitchen updated.`);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!session)
    return <main className="admin-page">Sign in to manage the home page.</main>;

  return (
    <main className="admin-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-eyebrow">Home page</p>
          <h1 className="admin-title mt-2">Home page manager</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Control the ordering cards shown on the customer home page. These
            cards decide how customers enter meal boxes, packages, or the custom
            menu builder.
          </p>
        </div>
        <div className="rounded-2xl border bg-white/80 px-4 py-3 text-sm text-muted-foreground">
          <Home className="mr-2 inline h-4 w-4 text-primary" />
          Customer landing controls
        </div>
      </div>

      {(message || error) && (
        <div className="mt-5 grid gap-3">
          {message && (
            <p className="rounded-xl border-l-4 border-primary bg-primary/10 px-4 py-3 text-sm font-semibold text-primary shadow-sm">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 shadow-sm">
              {error}
            </p>
          )}
        </div>
      )}

      <section className="mt-7 grid gap-4 xl:grid-cols-3">
        {offerings.map((offering) => (
          <article key={offering.code} className="admin-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {offering.code.replaceAll('_', ' ')}
                </p>
                <h2 className="mt-2 text-xl font-semibold">{offering.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {offering.description}
                </p>
              </div>
              <Switch
                checked={offering.isActive}
                onChange={(event) =>
                  updateOffering(offering, { isActive: event.target.checked })
                }
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border bg-muted/30">
              <div className="grid aspect-[16/10] place-items-center bg-muted">
                {offering.imageUrl ? (
                  <img
                    src={resolveMediaUrl(offering.imageUrl)}
                    alt={offering.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="p-3">
                <MediaUploader
                  compact
                  value={offering.imageUrl ?? ''}
                  onChange={(imageUrl) =>
                    updateOffering(offering, { imageUrl })
                  }
                  accessToken={session.accessToken}
                  label={`${offering.title} card image`}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <Field label="Display order">
                <Input
                  type="number"
                  min={0}
                  defaultValue={offering.displayOrder}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (value !== offering.displayOrder)
                      updateOffering(offering, { displayOrder: value });
                  }}
                />
              </Field>
              <Field label="Card image URL">
                <Input
                  defaultValue={offering.imageUrl ?? ''}
                  placeholder="/order-mealbox.png"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== (offering.imageUrl ?? ''))
                      updateOffering(offering, { imageUrl: value });
                  }}
                />
              </Field>
              <Field label="CTA label">
                <Input
                  defaultValue={offering.ctaLabel ?? ''}
                  placeholder="Explore"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== (offering.ctaLabel ?? ''))
                      updateOffering(offering, { ctaLabel: value });
                  }}
                />
              </Field>
            </div>
          </article>
        ))}
      </section>

      {!offerings.length && !error && (
        <div className="admin-card mt-7 text-center text-muted-foreground">
          Loading home page cards…
        </div>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="admin-eyebrow">Kitchen locations</p>
            <h2 className="admin-title mt-2">Public kitchen cards</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              These details power the kitchen cards on the customer home and
              about pages, including FSSAI numbers, photos, addresses and map
              links.
            </p>
          </div>
          <div className="rounded-2xl border bg-white/80 px-4 py-3 text-sm text-muted-foreground">
            <MapPin className="mr-2 inline h-4 w-4 text-primary" />
            {regions.length} kitchens configured
          </div>
        </div>

        <div className="mt-7 grid gap-4 xl:grid-cols-4">
          {regions.map((region) => (
            <article key={region.id} className="admin-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {region.code}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    {region.name} Kitchen
                  </h3>
                </div>
                <Switch
                  checked={region.isActive}
                  onChange={(event) =>
                    updateRegion(region, { isActive: event.target.checked })
                  }
                />
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border bg-muted/30">
                <div className="grid aspect-[16/9] place-items-center bg-muted">
                  {region.kitchenImageUrl ? (
                    <img
                      src={resolveMediaUrl(region.kitchenImageUrl)}
                      alt={`${region.name} kitchen`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3">
                  <MediaUploader
                    compact
                    value={region.kitchenImageUrl ?? ''}
                    onChange={(kitchenImageUrl) =>
                      updateRegion(region, { kitchenImageUrl })
                    }
                    accessToken={session.accessToken}
                    label={`${region.name} kitchen photo`}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <Field label="Display order">
                  <Input
                    type="number"
                    min={0}
                    defaultValue={region.publicDisplayOrder}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (value !== region.publicDisplayOrder)
                        updateRegion(region, { publicDisplayOrder: value });
                    }}
                  />
                </Field>
                <Field label="Kitchen name">
                  <Input
                    defaultValue={region.name}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && value !== region.name)
                        updateRegion(region, { name: value });
                    }}
                  />
                </Field>
                <Field label="Kitchen address">
                  <Textarea
                    rows={4}
                    defaultValue={region.kitchenAddress ?? ''}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value !== (region.kitchenAddress ?? ''))
                        updateRegion(region, { kitchenAddress: value });
                    }}
                  />
                </Field>
                <Field label="FSSAI license" optional>
                  <Input
                    defaultValue={region.fssaiLicenseNo ?? ''}
                    placeholder="Leave blank for In Process"
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value !== (region.fssaiLicenseNo ?? ''))
                        updateRegion(region, { fssaiLicenseNo: value });
                    }}
                  />
                </Field>
                <Field label="Map URL" optional>
                  <Input
                    defaultValue={region.mapUrl ?? ''}
                    placeholder={`https://www.google.com/maps?q=${region.centerLatitude},${region.centerLongitude}`}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value !== (region.mapUrl ?? ''))
                        updateRegion(region, { mapUrl: value });
                    }}
                  />
                </Field>
                <Field label="Photo URL" optional>
                  <Input
                    defaultValue={region.kitchenImageUrl ?? ''}
                    placeholder="/office-hero.png"
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value !== (region.kitchenImageUrl ?? ''))
                        updateRegion(region, { kitchenImageUrl: value });
                    }}
                  />
                </Field>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-6 rounded-2xl border bg-white/80 p-4 text-sm text-muted-foreground">
        <Save className="mr-2 inline h-4 w-4 text-primary" />
        Changes save automatically when you update a card field.
      </div>
    </main>
  );
}
