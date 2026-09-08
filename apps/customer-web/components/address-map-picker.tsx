'use client';

import { importLibrary } from '@googlemaps/js-api-loader';
import { Crosshair, LoaderCircle, MapPin, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { publicEnv } from '../lib/public-env';
import { configureGoogleMaps } from '../lib/google-maps';
import { Button } from './ui/button';

export type MapAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  latitude: string;
  longitude: string;
};

type PickerStatus =
  | 'idle'
  | 'loading-map'
  | 'locating'
  | 'geocoding'
  | 'ready'
  | 'error';

const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f0e8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#554b45' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#faf7f2' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d9cfc4' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#eee8df' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#dfe8d8' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#f7f2eb' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#ead9bd' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#e7dfd6' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#d7e5e7' }],
  },
];

function componentValue(
  components: google.maps.GeocoderAddressComponent[],
  ...types: string[]
) {
  return (
    components.find((component) =>
      types.some((type) => component.types.includes(type)),
    )?.long_name ?? ''
  );
}

function parseAddress(
  result: google.maps.GeocoderResult,
  position: google.maps.LatLngLiteral,
): MapAddress {
  const components = result.address_components;
  const streetNumber = componentValue(components, 'street_number');
  const route = componentValue(components, 'route');
  const premise = componentValue(components, 'premise');
  const subpremise = componentValue(components, 'subpremise');
  const pointOfInterest = componentValue(
    components,
    'point_of_interest',
    'establishment',
  );
  const locality = componentValue(
    components,
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
  );

  return {
    addressLine1:
      [subpremise, premise, streetNumber, route].filter(Boolean).join(', ') ||
      pointOfInterest ||
      result.formatted_address.split(',')[0],
    addressLine2: locality,
    city: componentValue(
      components,
      'locality',
      'postal_town',
      'administrative_area_level_2',
    ),
    state: componentValue(components, 'administrative_area_level_1'),
    pincode: componentValue(components, 'postal_code'),
    landmark:
      pointOfInterest && pointOfInterest !== premise ? pointOfInterest : '',
    latitude: position.lat.toFixed(8),
    longitude: position.lng.toFixed(8),
  };
}

export async function reverseGeocodeLocation(
  latitude: string,
  longitude: string,
) {
  const apiKey = publicEnv.googleMapsApiKey;
  if (!apiKey) return undefined;
  const position = { lat: Number(latitude), lng: Number(longitude) };
  if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng))
    return undefined;
  configureGoogleMaps(apiKey);
  await importLibrary('geocoding');
  const response = await new google.maps.Geocoder().geocode({
    location: position,
  });
  return response.results[0]
    ? parseAddress(response.results[0], position)
    : undefined;
}

function placeComponentValue(
  components: google.maps.places.AddressComponent[],
  ...types: string[]
) {
  return (
    components.find((component) =>
      types.some((type) => component.types.includes(type)),
    )?.longText ?? ''
  );
}

function parsePlaceAddress(
  place: google.maps.places.Place,
  position: google.maps.LatLngLiteral,
): MapAddress {
  const components = place.addressComponents ?? [];
  const streetNumber = placeComponentValue(components, 'street_number');
  const route = placeComponentValue(components, 'route');
  const premise = placeComponentValue(components, 'premise');
  const subpremise = placeComponentValue(components, 'subpremise');
  const locality = placeComponentValue(
    components,
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
  );
  const displayName = place.displayName?.trim() ?? '';
  const formattedAddress = place.formattedAddress?.trim() ?? '';

  return {
    addressLine1:
      [subpremise, premise, streetNumber, route].filter(Boolean).join(', ') ||
      displayName ||
      formattedAddress.split(',')[0] ||
      '',
    addressLine2: locality,
    city: placeComponentValue(
      components,
      'locality',
      'postal_town',
      'administrative_area_level_2',
    ),
    state: placeComponentValue(components, 'administrative_area_level_1'),
    pincode: placeComponentValue(components, 'postal_code'),
    landmark:
      displayName &&
      displayName !== premise &&
      !formattedAddress.startsWith(displayName)
        ? displayName
        : '',
    latitude: position.lat.toFixed(8),
    longitude: position.lng.toFixed(8),
  };
}

export function AddressMapPicker({
  onAddress,
  initialPosition,
}: {
  onAddress: (address: MapAddress) => void;
  initialPosition?: { latitude: string; longitude: string };
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const searchElement = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const initialPositionRef = useRef(initialPosition);
  const [status, setStatus] = useState<PickerStatus>('idle');
  const [message, setMessage] = useState('');
  const apiKey = publicEnv.googleMapsApiKey;

  async function selectPosition(
    position: google.maps.LatLngLiteral,
    zoom = 17,
  ) {
    if (!map.current || !marker.current || !geocoder.current) return;
    marker.current.setPosition(position);
    map.current.panTo(position);
    map.current.setZoom(zoom);
    setStatus('geocoding');
    setMessage('Finding the postal address…');
    try {
      const response = await geocoder.current.geocode({ location: position });
      if (!response.results[0])
        throw new Error('No address was found for this point.');
      const address = parseAddress(response.results[0], position);
      onAddress(address);
      setStatus('ready');
      setMessage(
        address.pincode
          ? 'Location selected. Review the address below.'
          : 'Location selected, but the pincode needs to be entered manually.',
      );
    } catch {
      onAddress({
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
        landmark: '',
        latitude: position.lat.toFixed(8),
        longitude: position.lng.toFixed(8),
      });
      setStatus('error');
      setMessage(
        'We saved the map pin, but could not resolve its postal address. Please complete the fields manually.',
      );
    }
  }

  useEffect(() => {
    if (!apiKey || !mapElement.current || !searchElement.current) return;
    let active = true;
    let placeAutocomplete: google.maps.places.PlaceAutocompleteElement | null =
      null;
    setStatus('loading-map');
    setMessage('Loading Google Maps…');

    configureGoogleMaps(apiKey);
    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('places'),
      importLibrary('geocoding'),
    ])
      .then(([, , placesLibrary]) => {
        if (!active || !mapElement.current || !searchElement.current) return;
        map.current = new google.maps.Map(mapElement.current, {
          center: INDIA_CENTER,
          zoom: 5,
          styles: MAP_STYLES,
          backgroundColor: '#f5f0e8',
          controlSize: 36,
          gestureHandling: 'cooperative',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        marker.current = new google.maps.Marker({
          map: map.current,
          draggable: true,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#7a1f2b',
            fillOpacity: 1,
            strokeColor: '#c49a36',
            strokeWeight: 4,
          },
        });
        geocoder.current = new google.maps.Geocoder();

        placeAutocomplete = new placesLibrary.PlaceAutocompleteElement({
          includedRegionCodes: ['in'],
          placeholder: 'Search for an address or venue',
          requestedLanguage: 'en',
          requestedRegion: 'in',
        });
        placeAutocomplete.className = 'map-place-autocomplete';
        placeAutocomplete.addEventListener('gmp-select', async (event) => {
          setStatus('geocoding');
          setMessage('Loading the selected place…');
          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({
              fields: [
                'addressComponents',
                'displayName',
                'formattedAddress',
                'location',
                'viewport',
              ],
            });
            const location = place.location;
            if (!location) throw new Error('Selected place has no location');
            const position = { lat: location.lat(), lng: location.lng() };
            marker.current?.setPosition(position);
            if (place.viewport) map.current?.fitBounds(place.viewport);
            else {
              map.current?.panTo(position);
              map.current?.setZoom(17);
            }
            const address = parsePlaceAddress(place, position);
            onAddress(address);
            setStatus('ready');
            setMessage(
              address.pincode
                ? 'Location selected. Review the address below.'
                : 'Location selected, but the pincode needs to be entered manually.',
            );
          } catch (reason) {
            console.error('[AddressMapPicker] Place selection failed', reason);
            setStatus('error');
            setMessage(
              'We could not load that place. Try another result or choose a point on the map.',
            );
          }
        });
        placeAutocomplete.addEventListener('gmp-error', () => {
          setStatus('error');
          setMessage(
            'Place search is temporarily unavailable. You can still choose a point on the map.',
          );
        });
        searchElement.current.replaceChildren(placeAutocomplete);

        map.current.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng)
            void selectPosition({
              lat: event.latLng.lat(),
              lng: event.latLng.lng(),
            });
        });
        marker.current.addListener('dragend', () => {
          const position = marker.current?.getPosition();
          if (position)
            void selectPosition({ lat: position.lat(), lng: position.lng() });
        });
        setStatus('idle');
        setMessage(
          'Search, click the map, drag the pin, or use your current location.',
        );
        const initial = initialPositionRef.current;
        if (initial) {
          const latitude = Number(initial.latitude);
          const longitude = Number(initial.longitude);
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            void selectPosition({ lat: latitude, lng: longitude }, 17);
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
        setMessage(
          'Google Maps could not load. You can still enter the address manually.',
        );
      });

    return () => {
      active = false;
      placeAutocomplete?.remove();
    };
  }, [apiKey]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus('error');
      setMessage(
        'This browser does not support location access. Please choose a point on the map or enter it manually.',
      );
      return;
    }
    setStatus('locating');
    setMessage('Getting your accurate location…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        void selectPosition(
          { lat: coords.latitude, lng: coords.longitude },
          18,
        ),
      (error) => {
        setStatus('error');
        if (error.code === error.PERMISSION_DENIED)
          setMessage(
            'Location permission was denied. Allow it in Chrome settings or choose a point on the map.',
          );
        else if (error.code === error.TIMEOUT)
          setMessage(
            'Location request timed out. Try again or choose a point on the map.',
          );
        else
          setMessage(
            'Your current location is unavailable. Search or choose a point on the map instead.',
          );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="font-semibold text-amber-900">
          Map selection is not configured
        </p>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable place search and map
          selection. Manual address entry remains available.
        </p>
      </div>
    );
  }

  const busy =
    status === 'loading-map' || status === 'locating' || status === 'geocoding';
  const statusStyle =
    status === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : status === 'ready'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-border bg-white text-muted-foreground';

  return (
    <div className="address-map-picker rounded-2xl border border-border bg-[hsl(var(--ivory))] p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="map-search-shell relative z-20 flex min-h-12 min-w-0 flex-1 items-center overflow-visible rounded-xl border border-border bg-white shadow-sm transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center border-r border-border bg-muted/40 text-primary">
            <Search className="h-4 w-4" />
          </span>
          <div
            ref={searchElement}
            className="map-place-search min-h-12 min-w-0 flex-1"
            aria-label="Search Google Maps"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={useCurrentLocation}
          disabled={busy}
          className="h-12 rounded-xl border-primary/25 bg-primary/[0.04] px-5 font-semibold text-primary shadow-sm hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          {status === 'locating' ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="mr-2 h-4 w-4" />
          )}
          Use my location
        </Button>
      </div>
      <div className="relative mt-3 overflow-hidden rounded-2xl border-4 border-white bg-muted shadow-[0_16px_40px_rgba(74,43,35,0.14)] ring-1 ring-border">
        <div
          ref={mapElement}
          className="h-[320px] w-full sm:h-[420px]"
          aria-label="Choose address on Google Map"
        />
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 text-xs font-semibold text-foreground shadow-md backdrop-blur">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Click the map or drag the pin
        </div>
      </div>
      <div
        className={`mt-3 flex min-h-12 items-start gap-2 rounded-xl border px-3.5 py-3 text-sm leading-5 ${statusStyle}`}
        role="status"
      >
        {busy ? (
          <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : (
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        )}
        <span>{message}</span>
      </div>
    </div>
  );
}
