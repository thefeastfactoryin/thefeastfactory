'use client';

import type { LocationResolution, UserAddress } from '@aranyam/shared-types';
import {
  AlertCircle,
  Check,
  ChevronDown,
  LoaderCircle,
  MapPin,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { apiRequest } from '../lib/api';
import {
  distanceBetweenKm,
  useDeliveryLocationStore,
  type DeliveryLocation,
} from '../store/delivery-location.store';
import { useSessionStore } from '../store/session.store';
import { useAddressBookStore } from '../store/address-book.store';
import {
  AddressMapPicker,
  reverseGeocodeLocation,
  type MapAddress,
} from './address-map-picker';

const DELIVERY_LEAD_TIME_HOURS = 24;
const SAVED_ADDRESS_MATCH_KM = 0.5;

type LocationNotice = {
  title: string;
  detail: string;
  serviceable: boolean;
};

function formatDeliveryEstimate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((values, part) => {
      values[part.type] = part.value;
      return values;
    }, {});

  return `${parts.day} ${parts.month} · ${parts.hour}:${parts.minute} ${parts.dayPeriod?.toUpperCase()}`;
}

function getLocationArea(location?: DeliveryLocation) {
  const locality = location?.address?.addressLine2?.trim();
  if (locality) return locality;

  const label = location?.label?.trim();
  if (label) return label.replace(/^near\s+/i, '');

  return location?.address?.city;
}

function formatCandidateAddress(address: MapAddress) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(', ');
}

function nearestSavedAddress(
  addresses: UserAddress[],
  latitude: string,
  longitude: string,
) {
  return addresses
    .filter((address) => address.latitude && address.longitude)
    .map((address) => ({
      address,
      distanceKm: distanceBetweenKm(
        latitude,
        longitude,
        address.latitude!,
        address.longitude!,
      ),
    }))
    .filter((entry) => entry.distanceKm <= SAVED_ADDRESS_MATCH_KM)
    .sort((first, second) => first.distanceKm - second.distanceKm)[0]
    ?.address;
}

export function DeliveryLocationSelector({
  active,
  variant = 'bar',
}: {
  active: boolean;
  variant?: 'bar' | 'responsive' | 'header';
}) {
  const pathname = usePathname();
  const session = useSessionStore((state) => state.session);
  const location = useDeliveryLocationStore((state) => state.location);
  const status = useDeliveryLocationStore((state) => state.status);
  const error = useDeliveryLocationStore((state) => state.error);
  const setStatus = useDeliveryLocationStore((state) => state.setStatus);
  const setLocation = useDeliveryLocationStore((state) => state.setLocation);
  const setError = useDeliveryLocationStore((state) => state.setError);
  const [open, setOpen] = useState(false);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [notice, setNotice] = useState<LocationNotice>();
  const [deliveryEstimate, setDeliveryEstimate] = useState('');
  const addressBookRevision = useAddressBookStore((state) => state.revision);
  const initialHomeLocated = useRef(false);
  const selectionRequestId = useRef(0);

  useEffect(() => {
    if (!active) return;
    setDeliveryEstimate(
      formatDeliveryEstimate(
        new Date(Date.now() + DELIVERY_LEAD_TIME_HOURS * 60 * 60 * 1000),
      ),
    );
  }, [active]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 5_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (
      !active ||
      pathname !== '/' ||
      location ||
      initialHomeLocated.current
    )
      return;
    initialHomeLocated.current = true;
    if (!navigator.geolocation) {
      setOpen(true);
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (
          window.location.pathname !== '/' ||
          useDeliveryLocationStore.getState().location
        )
          return;
        const latitude = coords.latitude.toFixed(8);
        const longitude = coords.longitude.toFixed(8);
        setStatus('resolving');
        void Promise.all([
          findNearbySavedAddress(latitude, longitude),
          reverseGeocodeLocation(latitude, longitude).catch(() => undefined),
        ])
          .then(async ([nearbyAddress, address]) => {
            const resolution = await resolve(
              nearbyAddress?.latitude ?? latitude,
              nearbyAddress?.longitude ?? longitude,
            );
            if (
              window.location.pathname !== '/' ||
              useDeliveryLocationStore.getState().location
            )
              return;
            setLocation(nearbyAddress
              ? locationFromSavedAddress(nearbyAddress, resolution)
              : {
              latitude,
              longitude,
              accuracyMeters: coords.accuracy,
              label:
                address?.addressLine2 ||
                address?.addressLine1 ||
                address?.city ||
                resolution.region?.name ||
                'Current location',
              source: 'browser',
              address: address
                ? {
                    addressLine1: address.addressLine1,
                    addressLine2: address.addressLine2,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode,
                    landmark: address.landmark,
                  }
                : undefined,
              resolution,
            });
          })
          .catch((reason) => {
            if (
              window.location.pathname !== '/' ||
              useDeliveryLocationStore.getState().location
            )
              return;
            setError((reason as Error).message);
            setOpen(true);
          });
      },
      () => {
        if (
          window.location.pathname !== '/' ||
          useDeliveryLocationStore.getState().location
        )
          return;
        setStatus('idle');
        setOpen(true);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, [active, location, pathname]);

  useEffect(() => {
    if (!session) {
      setAddresses([]);
      setAddressesLoaded(true);
      return;
    }
    let current = true;
    setAddressesLoaded(false);
    apiRequest<UserAddress[]>('/me/addresses', {}, session.accessToken)
      .then((rows) => {
        if (current) setAddresses(rows);
      })
      .catch(() => {
        if (current) setAddresses([]);
      })
      .finally(() => {
        if (current) setAddressesLoaded(true);
      });
    return () => {
      current = false;
    };
  }, [session, addressBookRevision]);

  useEffect(() => {
    if (!addressesLoaded || !location || location.savedAddressId) return;
    const nearby = nearestSavedAddress(
      addresses,
      location.latitude,
      location.longitude,
    );
    if (nearby) void selectSavedAddress(nearby, false, location);
  }, [addresses, addressesLoaded, location]);

  async function findNearbySavedAddress(latitude: string, longitude: string) {
    if (!session) return undefined;
    const savedAddresses = addressesLoaded
      ? addresses
      : await apiRequest<UserAddress[]>(
          '/me/addresses',
          {},
          session.accessToken,
        ).catch(() => addresses);
    return nearestSavedAddress(savedAddresses, latitude, longitude);
  }

  async function resolve(latitude: string, longitude: string) {
    return apiRequest<LocationResolution>('/operating-regions/resolve', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  }

  async function selectSavedAddress(
    address: UserAddress,
    close = true,
    expectedLocation?: DeliveryLocation,
  ) {
    if (!address.latitude || !address.longitude) return;
    const requestId = close ? ++selectionRequestId.current : undefined;
    setStatus('resolving');
    try {
      const resolution = await resolve(address.latitude, address.longitude);
      if (requestId && requestId !== selectionRequestId.current) return;
      if (
        expectedLocation &&
        useDeliveryLocationStore.getState().location !== expectedLocation
      )
        return;
      setLocation(locationFromSavedAddress(address, resolution));
      if (close) {
        setNotice({
          title: 'Delivery location updated',
          detail: `${address.label || address.addressLine1} · ${resolution.serviceable ? 'Delivery available' : 'Delivery unavailable here'}`,
          serviceable: resolution.serviceable,
        });
        closeSelector();
      }
    } catch (reason) {
      if (requestId && requestId !== selectionRequestId.current) return;
      if (
        expectedLocation &&
        useDeliveryLocationStore.getState().location !== expectedLocation
      )
        return;
      setError((reason as Error).message);
    }
  }

  function closeSelector() {
    selectionRequestId.current += 1;
    setCandidateLoading(false);
    setOpen(false);
  }

  async function inspectCandidate(address: MapAddress) {
    const requestId = ++selectionRequestId.current;
    if (!address.addressLine1.trim()) {
      setCandidateLoading(false);
      setError('Google Maps could not find an address for this pin. Choose a nearby point.');
      return;
    }
    setCandidateLoading(true);
    try {
      const nearby = await findNearbySavedAddress(
        address.latitude,
        address.longitude,
      );
      if (requestId !== selectionRequestId.current) return;
      const resolution = await resolve(
        nearby?.latitude ?? address.latitude,
        nearby?.longitude ?? address.longitude,
      );
      if (requestId !== selectionRequestId.current) return;
      setLocation(
        nearby
          ? locationFromSavedAddress(nearby, resolution)
          : {
              latitude: address.latitude,
              longitude: address.longitude,
              label:
                address.addressLine2 ||
                address.addressLine1 ||
                address.city ||
                resolution.region?.name ||
                'Selected location',
              source: 'manual',
              address: {
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                landmark: address.landmark,
              },
              resolution,
            },
      );
      setNotice({
        title: nearby
          ? 'Nearby saved address selected'
          : 'Delivery location updated',
        detail: `${nearby?.label || formatCandidateAddress(address) || 'Selected map point'} · ${resolution.serviceable ? 'Delivery available' : 'Delivery unavailable here'}`,
        serviceable: resolution.serviceable,
      });
      closeSelector();
    } catch (reason) {
      if (requestId !== selectionRequestId.current) return;
      setError((reason as Error).message);
    } finally {
      if (requestId === selectionRequestId.current) {
        setCandidateLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!active) closeSelector();
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!active) return null;

  const serviceMessage = location
    ? location.resolution.serviceable
      ? `${location.resolution.region?.name} Kitchen can serve this location`
      : location.resolution.reason === 'KITCHEN_CLOSED'
        ? `${location.resolution.region?.name} Kitchen is currently closed`
        : `Outside our service area${location.resolution.region ? ` · nearest is ${location.resolution.region.name}` : ''}`
    : status === 'locating'
      ? 'Requesting your location…'
      : status === 'resolving'
        ? 'Checking kitchen availability…'
        : error || 'Choose a location to check kitchen availability';

  return (
    <>
      {notice &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className={`fixed left-4 right-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-[110] mx-auto flex max-w-md items-start gap-3 rounded-xl border p-4 shadow-xl sm:left-auto sm:right-6 sm:top-20 ${notice.serviceable ? 'border-emerald-200 bg-white text-emerald-800' : 'border-amber-200 bg-white text-amber-900'}`}
          >
            {notice.serviceable ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{notice.title}</p>
              <p className="mt-0.5 break-words text-xs leading-5 text-foreground/75">
                {notice.detail}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotice(undefined)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Dismiss location confirmation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>,
          document.body,
        )}
      {variant === 'header' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="order-3 flex basis-full h-10 w-full min-w-0 flex-none items-center justify-start gap-2 border-y border-border/70 bg-[hsl(var(--ivory-warm))] px-0 text-left text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:order-none sm:basis-auto sm:h-11 sm:w-auto sm:min-w-[260px] sm:max-w-[340px] sm:gap-2.5 sm:rounded-xl sm:border sm:bg-white sm:px-3 sm:shadow-[0_2px_8px_rgba(45,31,20,0.04)]"
          aria-label={
            location
              ? location.resolution.serviceable
                ? `Delivery by ${deliveryEstimate || 'tomorrow'} to ${location.label}`
                : `Unavailable at this location: ${location.label}`
              : 'Set delivery location'
          }
          title={
            location
              ? location.resolution.serviceable
                ? `Delivery by ${deliveryEstimate || 'tomorrow'} to ${location.label}`
                : `Unavailable at this location: ${location.label}`
              : 'Set delivery location'
          }
        >
          <span className="relative grid h-6 w-6 shrink-0 place-items-center text-primary sm:h-auto sm:w-auto">
            {status === 'locating' || status === 'resolving' ? (
              <LoaderCircle className="h-4 w-4 animate-spin sm:h-[18px] sm:w-[18px]" />
            ) : (
              <MapPin className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            )}
            {location?.resolution.serviceable && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white sm:-right-1 sm:-top-1 sm:bottom-auto sm:h-2 sm:w-2" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
            <span className="min-w-0 flex-1 leading-none">
              <span className="block truncate text-[11px] font-bold text-foreground/75">
                {getLocationArea(location) ||
                  (status === 'locating'
                    ? 'Detecting…'
                    : status === 'resolving'
                      ? 'Checking…'
                      : 'Set location')}
              </span>
            </span>
            {deliveryEstimate && (
              <span className="block shrink-0 max-w-[45%] truncate whitespace-nowrap text-[10px] font-semibold text-primary/80 min-[375px]:text-[11px]">
                Earliest: {deliveryEstimate}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </span>
          <span className="hidden min-w-0 flex-1 sm:block">
            <span
              className={`flex min-w-0 items-center gap-1 whitespace-nowrap text-[13px] font-bold leading-none ${
                location && !location.resolution.serviceable
                  ? 'text-red-700'
                  : 'text-primary'
              }`}
            >
              <Zap
                className="h-4 w-4 shrink-0 fill-current"
                aria-hidden="true"
              />
              <span className="truncate">
                {!location
                  ? 'Set delivery location'
                  : !location.resolution.serviceable
                    ? 'Unavailable at this location'
                    : deliveryEstimate
                      ? `Delivery by ${deliveryEstimate}`
                      : 'Calculating delivery time…'}
              </span>
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-1 text-[13px] font-medium leading-none text-foreground/70">
              <span className="truncate">
                {getLocationArea(location) ||
                  (status === 'locating'
                    ? 'Detecting location…'
                    : status === 'resolving'
                      ? 'Checking location…'
                      : 'Set location')}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </span>
          </span>
        </button>
      )}

      {variant !== 'header' && (
        <section
          className={`border-b border-border bg-white ${
            variant === 'responsive' ? 'md:hidden' : ''
          }`}
        >
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:gap-3 sm:px-6 sm:py-3 lg:px-10">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-w-0 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:gap-3"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
                {status === 'locating' || status === 'resolving' ? (
                  <LoaderCircle className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
                ) : (
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[13px] font-extrabold text-foreground sm:text-sm">
                  <span className="truncate">
                    {location?.label || 'Set delivery location'}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                </span>
                <span
                  className={`mt-0.5 hidden truncate text-xs sm:block ${
                    location?.resolution.serviceable
                      ? 'text-emerald-700'
                      : location
                        ? 'text-amber-700'
                        : 'text-muted-foreground'
                  }`}
                >
                  {serviceMessage}
                </span>
              </span>
            </button>
            {location?.accuracyMeters && (
              <span className="text-xs text-muted-foreground">
                Approx. accuracy {Math.round(location.accuracyMeters)} m
              </span>
            )}
          </div>
        </section>
      )}

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm sm:grid sm:place-items-center sm:p-3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-location-title"
          >
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close location selector"
              onClick={closeSelector}
            />
            <section className="relative ml-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:ml-0 sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-2xl">
              <header className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3 sm:px-6 sm:py-4">
                <div>
                  <h2
                    id="delivery-location-title"
                    className="font-sans text-2xl font-semibold"
                  >
                    Choose delivery location
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeSelector}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="overscroll-contain overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:p-6">
                {error && (
                  <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                {addresses.length > 0 && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() =>
                        setShowSavedAddresses((visible) => !visible)
                      }
                      className="flex h-11 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold text-foreground transition hover:border-primary/40"
                      aria-expanded={showSavedAddresses}
                    >
                      Saved addresses ({addresses.length})
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showSavedAddresses ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {showSavedAddresses && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {addresses.map((address) => {
                          const usable = Boolean(
                            address.latitude && address.longitude,
                          );
                          const selected =
                            location?.savedAddressId === address.id;
                          return (
                            <button
                              key={address.id}
                              type="button"
                              disabled={!usable || status === 'resolving'}
                              onClick={() => void selectSavedAddress(address)}
                              className="relative rounded-xl border p-4 text-left transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-55"
                            >
                              <strong className="block pr-6 text-sm">
                                {address.label ||
                                  address.addressType
                                    .toLowerCase()
                                    .replace('_', ' ')}
                              </strong>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                {address.addressLine1}, {address.city}{' '}
                                {address.pincode}
                              </span>
                              {!usable && (
                                <span className="mt-2 block text-[11px] font-semibold text-amber-700">
                                  Add a map pin before using this address
                                </span>
                              )}
                              {selected && (
                                <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-white">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5">
                  {candidateLoading && (
                    <p role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2.5 text-sm font-medium text-primary">
                      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                      Checking your location and saved addresses…
                    </p>
                  )}
                  <AddressMapPicker
                    onAddress={(address) => void inspectCandidate(address)}
                    inlineMobileSearch
                  />
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

function locationFromSavedAddress(
  address: UserAddress,
  resolution: LocationResolution,
): DeliveryLocation {
  return {
    latitude: address.latitude!,
    longitude: address.longitude!,
    label:
      address.label ||
      address.addressLine2 ||
      address.addressLine1 ||
      address.city,
    source: 'saved',
    savedAddressId: address.id,
    address: {
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? undefined,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      landmark: address.landmark ?? undefined,
    },
    resolution,
  };
}
