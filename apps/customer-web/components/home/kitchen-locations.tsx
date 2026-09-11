import type { OperatingRegion } from '@aranyam/shared-types';
import { Building2, Hourglass, Landmark, MapPin } from 'lucide-react';
import Link from 'next/link';

const landmarkIcons: Record<string, string> = {
  warangal:
    '/kitchen-icons/warangal.png',
  hyderabad:
    '/kitchen-icons/hyderabad.png',
  karimnagar:
    '/kitchen-icons/karimnagar.png',
  khammam:
    '/kitchen-icons/khammam.png',
};

const aboutKitchenImages: Record<string, string> = {
  warangal: '/Warangal Kitchen.JPG',
  hyderabad: '/Hyderabad Kitchen.jpeg',
  karimnagar: '/Karimnagar Kitchen.png',
};

function normalizeCityKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\s*kitchen\s*/gi, '')
    .replace(/[^a-z]/g, '')
    .trim();
}

function mapHref(region: OperatingRegion) {
  return (
    region.mapUrl ||
    `https://www.google.com/maps?q=${region.centerLatitude},${region.centerLongitude}`
  );
}

function landmarkIconFor(location: OperatingRegion) {
  const key = normalizeCityKey(location.name);
  return landmarkIcons[key];
}

function FloralAccent({ side }: { side: 'left' | 'right' }) {
  const isLeft = side === 'left';

  return (
    <svg
      viewBox="0 0 80 180"
      aria-hidden="true"
      className={[
        'pointer-events-none absolute top-1/2 hidden h-[120px] w-[80px] -translate-y-1/2 opacity-80 sm:block',
        isLeft ? 'left-0' : 'right-0',
      ].join(' ')}
    >
      <g
        fill="none"
        stroke="#d4b27d"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      >
        <path
          d={
            isLeft
              ? 'M32 10C48 28 50 46 36 74C26 96 16 122 20 158'
              : 'M48 10C32 28 30 46 44 74C54 96 64 122 60 158'
          }
        />
        <path
          d={
            isLeft
              ? 'M16 32C26 28 36 34 38 44C35 54 24 57 16 54'
              : 'M64 32C54 28 44 34 42 44C45 54 56 57 64 54'
          }
        />
        <path
          d={
            isLeft
              ? 'M20 80C33 72 43 78 46 92C40 102 28 108 20 106'
              : 'M60 80C47 72 37 78 34 92C40 102 52 108 60 106'
          }
        />
        <path
          d={
            isLeft
              ? 'M20 130C28 120 36 122 42 135C34 146 24 150 18 148'
              : 'M60 130C52 120 44 122 38 135C46 146 56 150 62 148'
          }
        />
        <circle
          cx={isLeft ? 30 : 50}
          cy={isLeft ? 24 : 24}
          r="5"
          fill="#d4b27d"
          stroke="none"
        />
        <circle
          cx={isLeft ? 20 : 60}
          cy={isLeft ? 60 : 60}
          r="4"
          fill="#d4b27d"
          stroke="none"
        />
        <circle
          cx={isLeft ? 26 : 54}
          cy={isLeft ? 100 : 100}
          r="4.2"
          fill="#d4b27d"
          stroke="none"
        />
        <circle
          cx={isLeft ? 24 : 56}
          cy={isLeft ? 140 : 140}
          r="4"
          fill="#d4b27d"
          stroke="none"
        />
      </g>
    </svg>
  );
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

  if (variant === 'compact') {
    const visibleLocations = locations.slice(0, 4);

    return (
      <section id="kitchens" className={className}>
        <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-2xl border border-accent/30 bg-[#fffdfa] shadow-[0_8px_24px_rgba(74,43,35,0.03)]">
          <div className="flex flex-col lg:min-h-[128px] lg:flex-row">
            <div className="flex flex-col justify-center px-5 py-5 sm:px-7 lg:w-[30%] lg:px-8 lg:py-5">
              <p className="eyebrow">Our kitchens across Telangana</p>
              <h2 className="mt-2 max-w-[380px] font-serif text-[21px] font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
                Freshly prepared across{' '}
                <span className="text-gold-text">
                  {locations.length} cities.
                </span>
              </h2>
            </div>

            <div className="flex snap-x snap-mandatory overflow-x-auto border-t border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:min-w-0 lg:flex-1 lg:overflow-visible lg:border-l lg:border-t-0">
              {visibleLocations.map((location) => {
                const cityName = location.name.replace(/\s+Kitchen$/i, '');
                const iconSrc = landmarkIconFor(location);

                return (
                  <a
                    key={location.id}
                    href={mapHref(location)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-[138px] flex-1 snap-start flex-col items-center justify-center border-r border-border px-3 py-4 text-center transition-colors hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:min-w-[130px]"
                  >
                    <span className="flex h-9 items-center justify-center">
                      {iconSrc ? (
                        <img
                          src={iconSrc}
                          alt=""
                          aria-hidden="true"
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <Landmark className="h-7 w-7 text-primary" aria-hidden="true" />
                      )}
                    </span>
                    <h3 className="mt-2 text-sm font-extrabold text-foreground">
                      {cityName}
                    </h3>
                    <p
                      className={`mt-1 text-[10px] font-semibold ${
                        location.fssaiLicenseNo
                          ? 'text-muted-foreground'
                          : 'text-primary'
                      }`}
                    >
                      {location.fssaiLicenseNo
                        ? 'Licensed kitchen'
                        : 'License in process'}
                    </p>
                  </a>
                );
              })}
            </div>

            <div className="flex items-center justify-center border-t border-border p-4 lg:w-[170px] lg:border-l lg:border-t-0 lg:p-4">
              <Link
                href="/about#kitchens"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 text-xs font-bold text-primary transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:w-auto lg:whitespace-nowrap"
              >
                View All Kitchens{' '}
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="kitchens" className={className}>
      <div className="container-pad">
        <div
          className={
            variant === 'about'
              ? 'about-kitchen-panel relative'
              : 'relative flex flex-col gap-6 overflow-hidden rounded-xl border border-border bg-ivory px-5 py-6 shadow-[0_4px_18px_rgba(74,43,35,0.04)] sm:px-7 lg:flex-row lg:items-center lg:gap-0 lg:px-8 lg:py-6'
          }
        >
          {variant === 'about' && (
            <div className="pointer-events-none absolute left-8 top-1/2 hidden h-[120px] -translate-y-1/2 sm:block">
              <FloralAccent side="left" />
            </div>
          )}
          {variant === 'about' && (
            <div className="pointer-events-none absolute right-8 top-1/2 hidden h-[120px] -translate-y-1/2 sm:block">
              <FloralAccent side="right" />
            </div>
          )}
          {variant !== 'about' && <FloralAccent side="left" />}
          {variant !== 'about' && <FloralAccent side="right" />}
          {variant === 'about' && (
            <div className="about-kitchen-heading">
              <p className="eyebrow">Our kitchens across Telangana</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Food Prepared in Our Own Kitchens, Across {locations.length}{' '}
                Major Cities.
              </p>
            </div>
          )}
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

          <div
            className={
              variant === 'about'
                ? 'about-kitchen-grid'
                : 'grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6'
            }
          >
            {locations.map((location) => {
              const iconSrc = landmarkIconFor(location);
              const cityKey = normalizeCityKey(location.name);
              const kitchenImage =
                aboutKitchenImages[cityKey] ||
                location.kitchenImageUrl ||
                '/about-gathering.png';
              return (
                <a
                  key={location.id}
                  href={mapHref(location)}
                  target="_blank"
                  rel="noreferrer"
                  className={
                    variant === 'about'
                      ? 'about-kitchen-card group'
                      : 'group flex min-w-0 flex-col items-center justify-center border-border text-center sm:px-2 lg:border-r lg:last:border-r-0 lg:px-2'
                  }
                >
                  {variant === 'about' && (
                    <span
                      className="about-kitchen-photo"
                      aria-hidden="true"
                      style={{ backgroundImage: `url("${kitchenImage}")` }}
                    />
                  )}
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

          {variant !== 'about' && (
            <a
              href={mapHref(locations[0]!)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground shadow-[0_8px_18px_rgba(122,31,43,0.16)] transition-all duration-250 ease-premium hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:w-[132px]"
            >
              View All Kitchens{' '}
              <MapPin className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
