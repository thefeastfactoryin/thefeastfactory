import type { OperatingRegion } from '@aranyam/shared-types';
import { Building2, Hourglass, MapPin } from 'lucide-react';

const landmarkIcons: Record<string, string> = {
  warangal:
    '/kitchen-icons/ChatGPT%20Image%20Sep%2010,%202026%20at%2009_20_08%20PM.png',
  hyderabad:
    '/kitchen-icons/ChatGPT%20Image%20Sep%2010,%202026%20at%2009_22_14%20PM.png',
  karimnagar:
    '/kitchen-icons/ChatGPT%20Image%20Sep%2010,%202026%20at%2009_23_22%20PM.png',
  khammam:
    '/kitchen-icons/ChatGPT%20Image%20Sep%2010,%202026%20at%2009_24_17%20PM.png',
};

const aboutKitchenImages: Record<string, string> = {
  warangal: '/Warangal Kitchen.JPG',
  hyderabad: '/Hyderabad Kitchen.jpeg',
  karimnagar: '/Karimnagar Kitchen.png',
};

function mapHref(region: OperatingRegion) {
  return (
    region.mapUrl ||
    `https://www.google.com/maps?q=${region.centerLatitude},${region.centerLongitude}`
  );
}

function landmarkIconFor(location: OperatingRegion) {
  return landmarkIcons[location.name.trim().toLowerCase()];
}

export function KitchenLocationsSection({
  locations,
  className = '',
  variant = 'compact',
}: {
  locations: OperatingRegion[];
  className?: string;
  variant?: 'compact' | 'about';
}) {
  if (!locations.length) return null;

  return (
    <section className={className}>
      <div className="container-pad">
        <div className={variant === 'about' ? 'about-kitchen-panel' : 'flex flex-col gap-6 rounded-xl border border-border bg-ivory px-5 py-6 shadow-[0_4px_18px_rgba(74,43,35,0.04)] sm:px-7 lg:flex-row lg:items-center lg:gap-0 lg:px-8 lg:py-6'}>
          {variant === 'about' && <div className="about-kitchen-heading"><p className="eyebrow">Our kitchens across Telangana</p><p className="mt-1 text-xs text-muted-foreground">Food Prepared in Our Own Kitchens, Across {locations.length} Major Cities.</p></div>}
          {variant !== 'about' && (
          <div className="shrink-0 lg:w-[35%] lg:border-r lg:border-border lg:pr-8">
            <p className="eyebrow">Our kitchens across Telangana</p>
            <h2 className="mt-2 max-w-sm font-serif text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              Prepared in our own kitchens, across{' '}
              <span className="text-gold-text">{locations.length}</span> major
              cities.
            </h2>
          </div>
          )}

          <div className={variant === 'about' ? 'about-kitchen-grid' : 'grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6'}>
            {locations.map((location) => {
              const iconSrc = landmarkIconFor(location);
              if (variant === 'about') {
                const aboutImage =
                  aboutKitchenImages[location.name.trim().toLowerCase()] ||
                  location.kitchenImageUrl ||
                  '/about-gathering.png';
                return (
                  <article key={location.id} className="about-kitchen-card">
                    <div
                      className="about-kitchen-photo"
                      style={{
                        backgroundImage: `url("${aboutImage}")`,
                      }}
                    />
                    <h3 className="mt-3 font-serif text-lg font-bold text-foreground">
                      {location.name} Kitchen
                    </h3>
                    <p className="about-kitchen-address">
                      {location.kitchenAddress || 'Kitchen address available on request.'}
                    </p>
                    <div className="about-kitchen-license">
                      {location.fssaiLicenseNo ? (
                        <>
                          <span className="about-fssai-mark">fssai</span>
                          <span><small>FSSAI License No.</small><strong>{location.fssaiLicenseNo}</strong></span>
                        </>
                      ) : (
                        <span className="about-license-pending"><Hourglass className="h-4 w-4" /> FSSAI License<br />In Process</span>
                      )}
                    </div>
                    <a
                      href={mapHref(location)}
                      target="_blank"
                      rel="noreferrer"
                      className="about-kitchen-map"
                    >
                      View on Map <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </article>
                );
              }
              return (
                <a
                  key={location.id}
                  href={mapHref(location)}
                  target="_blank"
                  rel="noreferrer"
                  className={variant === 'about' ? 'about-kitchen-card group' : 'group flex min-w-0 flex-col items-center justify-center border-border text-center sm:px-2 lg:border-r lg:last:border-r-0 lg:px-2'}
                >
                  {variant === 'about' && <span className="about-kitchen-photo" aria-hidden="true" />}
                  <span className="flex h-11 items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5">
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt=""
                        aria-hidden="true"
                        className="h-11 w-14 object-contain"
                      />
                    ) : (
                      <Building2
                        className="h-9 w-9 text-primary"
                        strokeWidth={1.35}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <h3 className="mt-1 font-serif text-base font-bold text-foreground">
                    {location.name}
                  </h3>
                  <p className="mt-1 whitespace-nowrap text-[10px] leading-4 text-muted-foreground">
                    FSSAI License No.
                  </p>
                  <p className="numeric-text whitespace-nowrap text-[10px] font-semibold text-foreground">
                    {location.fssaiLicenseNo || 'In Process'}
                  </p>
                  {!location.isAcceptingOrders && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-700">
                      <Hourglass className="h-3 w-3" aria-hidden="true" />
                      Temporarily closed
                    </p>
                  )}
                </a>
              );
            })}
          </div>

          {variant !== 'about' && <a
            href={mapHref(locations[0]!)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground shadow-[0_8px_18px_rgba(122,31,43,0.16)] transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:w-[132px]"
          >
            View All Kitchens <MapPin className="h-4 w-4" aria-hidden="true" />
          </a>}
        </div>
      </div>
    </section>
  );
}
