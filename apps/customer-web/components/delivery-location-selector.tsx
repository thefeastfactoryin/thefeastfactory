'use client';

import type { LocationResolution, UserAddress } from '@aranyam/shared-types';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Crosshair,
  LoaderCircle,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { Button } from './ui/button';

const SAVED_ADDRESS_MATCH_KM = 0.5;

type LocationCandidate = {
  address: MapAddress;
  resolution: LocationResolution;
};

export function DeliveryLocationSelector({ active }: { active: boolean }) {
  const session = useSessionStore((state) => state.session);
  const location = useDeliveryLocationStore((state) => state.location);
  const status = useDeliveryLocationStore((state) => state.status);
  const error = useDeliveryLocationStore((state) => state.error);
  const setStatus = useDeliveryLocationStore((state) => state.setStatus);
  const setLocation = useDeliveryLocationStore((state) => state.setLocation);
  const setError = useDeliveryLocationStore((state) => state.setError);
  const [open, setOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [candidate, setCandidate] = useState<LocationCandidate>();
  const [candidateLoading, setCandidateLoading] = useState(false);
  const addressBookRevision = useAddressBookStore((state) => state.revision);
  const requestedAutomatically = useRef(false);
  const lastSavedMatchAttempt = useRef('');

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
    if (
      !active ||
      location ||
      !addressesLoaded ||
      requestedAutomatically.current
    )
      return;
    requestedAutomatically.current = true;
    locateCustomer();
  }, [active, addressesLoaded, location]);

  useEffect(() => {
    if (!session || !addressesLoaded || !location || location.savedAddressId)
      return;
    const attemptKey = `${session.user.id}:${location.latitude}:${location.longitude}:${addresses.length}`;
    if (lastSavedMatchAttempt.current === attemptKey) return;
    lastSavedMatchAttempt.current = attemptKey;
    const nearbyAddress = nearestSavedAddress(
      location.latitude,
      location.longitude,
    );
    if (nearbyAddress) void selectSavedAddress(nearbyAddress, false);
  }, [addresses, addressesLoaded, location, session]);

  async function resolve(latitude: string, longitude: string) {
    return apiRequest<LocationResolution>('/operating-regions/resolve', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  }

  function nearestSavedAddress(latitude: string, longitude: string) {
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

  async function selectCoordinates(
    latitude: string,
    longitude: string,
    accuracyMeters?: number,
  ) {
    setStatus('resolving');
    try {
      const nearbyAddress = nearestSavedAddress(latitude, longitude);
      const selectedLatitude = nearbyAddress?.latitude ?? latitude;
      const selectedLongitude = nearbyAddress?.longitude ?? longitude;
      const [resolution, detectedAddress] = await Promise.all([
        resolve(selectedLatitude, selectedLongitude),
        nearbyAddress
          ? Promise.resolve(undefined)
          : reverseGeocodeLocation(latitude, longitude).catch(() => undefined),
      ]);
      setLocation(
        nearbyAddress
          ? locationFromSavedAddress(nearbyAddress, resolution)
          : {
              latitude,
              longitude,
              accuracyMeters,
              label:
                detectedAddress?.addressLine2 ||
                detectedAddress?.addressLine1 ||
                detectedAddress?.city ||
                (resolution.region
                  ? `Near ${resolution.region.name}`
                  : 'Current location'),
              source: 'browser',
              address: detectedAddress
                ? {
                    addressLine1: detectedAddress.addressLine1,
                    addressLine2: detectedAddress.addressLine2,
                    city: detectedAddress.city,
                    state: detectedAddress.state,
                    pincode: detectedAddress.pincode,
                    landmark: detectedAddress.landmark,
                  }
                : undefined,
              resolution,
            },
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  function locateCustomer() {
    if (!navigator.geolocation) {
      setError(
        'Location is unavailable in this browser. Search for a delivery location instead.',
      );
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        void selectCoordinates(
          coords.latitude.toFixed(8),
          coords.longitude.toFixed(8),
          coords.accuracy,
        ),
      (reason) => {
        if (reason.code === reason.PERMISSION_DENIED) {
          setError(
            'Location permission was not granted. You can search for the delivery location instead.',
          );
          return;
        }
        setError(
          'We could not detect your location. Try again or search for the delivery location.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function selectSavedAddress(address: UserAddress, close = true) {
    if (!address.latitude || !address.longitude) return;
    setStatus('resolving');
    try {
      const resolution = await resolve(address.latitude, address.longitude);
      setLocation(locationFromSavedAddress(address, resolution));
      if (close) setOpen(false);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function inspectCandidate(address: MapAddress) {
    setCandidateLoading(true);
    try {
      setCandidate({
        address,
        resolution: await resolve(address.latitude, address.longitude),
      });
    } catch (reason) {
      setCandidate(undefined);
      setError((reason as Error).message);
    } finally {
      setCandidateLoading(false);
    }
  }

  function useCandidate() {
    if (!candidate) return;
    const { address, resolution } = candidate;
    setLocation({
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
    });
    setOpen(false);
    setShowMap(false);
  }

  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);

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
      <section className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              {status === 'locating' || status === 'resolving' ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <MapPin className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-extrabold text-foreground">
                <span className="truncate">
                  {location?.label || 'Set delivery location'}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
              </span>
              <span
                className={`mt-0.5 block truncate text-xs ${
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

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/60 p-3 backdrop-blur-sm sm:grid sm:place-items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-location-title"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close location selector"
            onClick={() => setOpen(false)}
          />
          <section className="relative ml-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:ml-0">
            <header className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="delivery-location-title"
                  className="font-serif text-2xl font-bold"
                >
                  Choose delivery location
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check serviceability here even if you are ordering for another
                  city.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="overflow-y-auto p-5 sm:p-6">
              <Button
                type="button"
                variant="outline"
                onClick={locateCustomer}
                disabled={status === 'locating' || status === 'resolving'}
                className="h-12 w-full justify-start rounded-xl"
              >
                <Crosshair className="mr-3 h-4 w-4 text-primary" />
                Use my current location
              </Button>

              {error && (
                <p className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              {addresses.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Saved addresses
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {addresses.map((address) => {
                      const usable = Boolean(
                        address.latitude && address.longitude,
                      );
                      const selected = location?.savedAddressId === address.id;
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
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowMap((shown) => !shown)}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90"
              >
                <Search className="h-4 w-4" />
                {showMap ? 'Hide location search' : 'Search another location'}
              </button>

              {showMap && (
                <div className="mt-5">
                  <AddressMapPicker
                    onAddress={(address) => void inspectCandidate(address)}
                  />
                  {(candidate || candidateLoading) && (
                    <div className="mt-4 rounded-xl border bg-muted/40 p-4">
                      {candidateLoading ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <LoaderCircle className="h-4 w-4 animate-spin" />{' '}
                          Checking this location…
                        </p>
                      ) : candidate ? (
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div>
                            <p className="text-sm font-bold">
                              {candidate.address.addressLine2 ||
                                candidate.address.addressLine1 ||
                                candidate.address.city}
                            </p>
                            <p
                              className={`mt-1 text-xs ${candidate.resolution.serviceable ? 'text-emerald-700' : 'text-amber-700'}`}
                            >
                              {candidate.resolution.serviceable
                                ? `${candidate.resolution.region?.name} Kitchen can serve this location.`
                                : candidate.resolution.reason ===
                                    'KITCHEN_CLOSED'
                                  ? `${candidate.resolution.region?.name} Kitchen is currently closed.`
                                  : 'This location is outside our current service area.'}
                            </p>
                          </div>
                          <Button type="button" onClick={useCandidate}>
                            Use this location
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
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
