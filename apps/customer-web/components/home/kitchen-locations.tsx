import type { OperatingRegion } from '@aranyam/shared-types';
import { Hourglass, ImagePlus, MapPin, ShieldCheck } from 'lucide-react';

function mapHref(region: OperatingRegion) {
  return (
    region.mapUrl ||
    `https://www.google.com/maps?q=${region.centerLatitude},${region.centerLongitude}`
  );
}

export function KitchenLocationsSection({
  locations,
  className = '',
}: {
  locations: OperatingRegion[];
  className?: string;
}) {
  if (!locations.length) return null;

  return (
    <section className={className}>
      <div className="container-pad">
        <div className="mb-6">
          <p className="eyebrow">Our kitchens across Telangana</p>
          <h2 className="mt-2 max-w-3xl font-serif text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            Food prepared in our own kitchens, across{' '}
            <span className="text-gold-text">{locations.length}</span> major
            cities.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {locations.map((location) => (
            <article
              key={location.id}
              className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_6px_22px_rgba(74,43,35,0.06)]"
            >
              <div className="relative aspect-[16/7] bg-muted">
                {location.kitchenImageUrl ? (
                  <img
                    src={location.kitchenImageUrl}
                    alt={`${location.name} kitchen team`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <ImagePlus className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col px-5 pb-5 pt-4 text-center">
                <h3 className="font-serif text-xl font-bold text-foreground">
                  {location.name} Kitchen
                </h3>
                <p className="mx-auto mt-3 min-h-[72px] max-w-[280px] text-sm leading-6 text-muted-foreground">
                  {location.kitchenAddress ||
                    'Kitchen address will be updated soon.'}
                </p>

                {location.fssaiLicenseNo ? (
                  <div className="mt-5 flex items-center justify-center gap-4">
                    <span className="font-serif text-4xl italic leading-none text-primary">
                      fssai
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-muted-foreground">
                        FSSAI License No.
                      </p>
                      <p className="numeric-text text-sm font-extrabold text-foreground">
                        {location.fssaiLicenseNo}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto mt-5 flex max-w-[260px] items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-left">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white">
                      <Hourglass className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-primary">
                        FSSAI License
                      </p>
                      <p className="text-sm font-extrabold text-primary">
                        In Process
                      </p>
                    </div>
                  </div>
                )}

                <a
                  href={mapHref(location)}
                  target="_blank"
                  rel="noreferrer"
                  className="mx-auto mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_8px_18px_rgba(122,31,43,0.16)] transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  View on Map <MapPin className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border bg-card px-4 py-4 text-center text-sm font-semibold text-foreground">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          Every kitchen follows strict hygiene, food safety and quality
          standards backed by valid food licenses.
        </div>
      </div>
    </section>
  );
}
