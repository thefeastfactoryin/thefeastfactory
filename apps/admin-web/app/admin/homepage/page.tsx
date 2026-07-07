'use client';

import Switch from '@mui/material/Switch';
import type { OrderingOffering } from '@aranyam/shared-types';
import { Home, ImagePlus, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaUploader } from '../../../components/media-uploader';
import { Field } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

export default function AdminHomepage() {
  const session = useAdminSessionStore((state) => state.session);
  const [offerings, setOfferings] = useState<OrderingOffering[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    apiRequest<OrderingOffering[]>(
      '/admin/catalog/ordering-offerings',
      {},
      session.accessToken,
    )
      .then(setOfferings)
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
                    src={offering.imageUrl}
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

      <div className="mt-6 rounded-2xl border bg-white/80 p-4 text-sm text-muted-foreground">
        <Save className="mr-2 inline h-4 w-4 text-primary" />
        Changes save automatically when you update a card field.
      </div>
    </main>
  );
}
