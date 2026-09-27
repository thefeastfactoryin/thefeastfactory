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

export type MapSelectionSource = 'map' | 'search' | 'current' | 'initial';

type PickerStatus =
  | 'idle'
  | 'loading-map'
  | 'locating'
  | 'geocoding'
  | 'ready'
  | 'error';

const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };
const MOBILE_MAP_QUERY = '(max-width: 767px), (pointer: coarse)';

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
  useFullAddress = false,
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
    'sublocality_level_2',
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
  );

  const addressLine1 =
    [subpremise, premise, streetNumber, route].filter(Boolean).join(', ') ||
    pointOfInterest ||
    result.formatted_address.split(',')[0];

  return {
    addressLine1: (useFullAddress
      ? result.formatted_address.trim() || addressLine1
      : addressLine1
    ).slice(0, 255),
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
    'sublocality_level_2',
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
  inlineMobileSearch = false,
  onSearchFocusChange,
  onSearchError,
}: {
  onAddress: (address: MapAddress, source: MapSelectionSource) => void;
  initialPosition?: { latitude: string; longitude: string };
  inlineMobileSearch?: boolean;
  /** Reports whether the place search field currently has focus, so a parent
   * sheet can free up room (or hide overlapping controls) while the mobile
   * keyboard is open. */
  onSearchFocusChange?: (focused: boolean) => void;
  /** Fired when a place fails to load, so a parent can clear any stale
   * "selected location" state instead of showing it beside the error. */
  onSearchError?: () => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const searchElement = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const searchToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const selectionVersion = useRef(0);
  const initialPositionRef = useRef(initialPosition);
  const [status, setStatus] = useState<PickerStatus>('idle');
  const [message, setMessage] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchReady, setSearchReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const apiKey = publicEnv.googleMapsApiKey;

  async function selectPosition(
    position: google.maps.LatLngLiteral,
    zoom = 17,
    source: MapSelectionSource = 'map',
  ) {
    if (!map.current || !marker.current || !geocoder.current) return;
    const version = ++selectionVersion.current;
    marker.current.setPosition(position);
    map.current.panTo(position);
    map.current.setZoom(zoom);
    setStatus('geocoding');
    setMessage('Finding the postal address…');
    try {
      const response = await geocoder.current.geocode({ location: position });
      if (version !== selectionVersion.current) return;
      if (!response.results[0])
        throw new Error('No address was found for this point.');
      const address = parseAddress(response.results[0], position, true);
      onAddress(address, source);
      setStatus('ready');
      setMessage(
        address.pincode
          ? 'Location selected. Review the address below.'
          : 'Location selected, but the pincode needs to be entered manually.',
      );
    } catch {
      if (version !== selectionVersion.current) return;
      onAddress({
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
        landmark: '',
        latitude: position.lat.toFixed(8),
        longitude: position.lng.toFixed(8),
      }, source);
      setStatus('error');
      setMessage('Google Maps could not find an address for this pin. Try a nearby point or enter the address manually.');
    }
  }

  async function selectPlace(prediction: google.maps.places.PlacePrediction) {
    const version = ++selectionVersion.current;
    setSuggestions([]);
    setSearchQuery(prediction.text.text);
    setSearchFocused(false);
    onSearchFocusChange?.(false);
    setStatus('geocoding');
    setMessage('Loading the selected place…');
    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: [
          'addressComponents',
          'displayName',
          'formattedAddress',
          'location',
          'viewport',
        ],
      });
      if (version !== selectionVersion.current) return;
      const location = place.location;
      if (!location) throw new Error('Selected place has no location');
      const position = { lat: location.lat(), lng: location.lng() };
      marker.current?.setPosition(position);
      if (place.viewport) map.current?.fitBounds(place.viewport);
      else {
        map.current?.panTo(position);
        map.current?.setZoom(17);
      }
      let address = parsePlaceAddress(place, position);
      if (!address.pincode && geocoder.current) {
        try {
          const response = await geocoder.current.geocode({ location: position });
          if (version !== selectionVersion.current) return;
          if (response.results[0]) address = parseAddress(response.results[0], position);
        } catch {
          // Keep the selected place details if reverse geocoding is unavailable.
        }
      }
      onAddress(address, 'search');
      setStatus('ready');
      setMessage(
        address.pincode
          ? 'Location selected. Review the address below.'
          : 'Location selected, but the pincode needs to be entered manually.',
      );
    } catch (reason) {
      if (version !== selectionVersion.current) return;
      console.error('[AddressMapPicker] Place selection failed', reason);
      setStatus('error');
      setMessage('We could not load that place. Try another result or choose a point on the map.');
      onSearchError?.();
    } finally {
      searchToken.current = null;
    }
  }

  useEffect(() => {
    if (!inlineMobileSearch || !searchReady || !searchFocused || searchQuery.trim().length < 2) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      searchToken.current ??= new google.maps.places.AutocompleteSessionToken();
      void google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: searchQuery.trim(),
        includedRegionCodes: ['in'],
        language: 'en',
        region: 'in',
        sessionToken: searchToken.current,
      })
        .then(({ suggestions: results }) => {
          if (active) setSuggestions(results.filter((result) => result.placePrediction));
        })
        .catch(() => {
          if (active) {
            setSuggestions([]);
            setMessage('Place search is temporarily unavailable. Choose a point on the map.');
          }
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [inlineMobileSearch, searchQuery, searchReady, searchFocused]);

  useEffect(() => {
    if (!apiKey || !mapElement.current || !searchElement.current) return;
    let active = true;
    let resizeFrame = 0;
    let placeAutocomplete: google.maps.places.PlaceAutocompleteElement | null =
      null;
    const searchContainer = searchElement.current;
    const mobileMap = window.matchMedia(MOBILE_MAP_QUERY);
    // The Places search field lives in a Shadow DOM; focus/blur on its inner
    // input still bubble as focusin/focusout on the host container, so track
    // focus here to free up room for suggestions above the keyboard.
    const handleFocusIn = () => {
      setSearchFocused(true);
      onSearchFocusChange?.(true);
      searchContainer.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    const handleFocusOut = () => {
      setSearchFocused(false);
      onSearchFocusChange?.(false);
    };
    searchContainer.addEventListener('focusin', handleFocusIn);
    searchContainer.addEventListener('focusout', handleFocusOut);
    const mapGestureHandling = () =>
      mobileMap.matches ? ('greedy' as const) : ('cooperative' as const);
    const resizeMap = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        const activeMap = map.current;
        if (!activeMap) return;
        const center = marker.current?.getPosition() ?? activeMap.getCenter();
        activeMap.setOptions({
          controlSize: mobileMap.matches ? 32 : 36,
          gestureHandling: mapGestureHandling(),
        });
        google.maps.event.trigger(activeMap, 'resize');
        if (center) activeMap.setCenter(center);
      });
    };

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
          controlSize: mobileMap.matches ? 32 : 36,
          // A single-finger drag is the expected interaction inside the mobile
          // location sheet. Desktop keeps cooperative scrolling behaviour.
          gestureHandling: mapGestureHandling(),
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
        setSearchReady(true);

        placeAutocomplete = new placesLibrary.PlaceAutocompleteElement({
          includedRegionCodes: ['in'],
          placeholder: 'Search for an address or venue',
          requestedLanguage: 'en',
          requestedRegion: 'in',
        });
        placeAutocomplete.className = 'map-place-autocomplete';
        placeAutocomplete.addEventListener('gmp-select', async (event) => {
          // Dismiss the keyboard as soon as a suggestion is tapped, before the
          // place details finish loading, so the result is never hidden
          // behind it (success or failure).
          placeAutocomplete?.blur();
          void selectPlace(event.placePrediction);
        });
        placeAutocomplete.addEventListener('gmp-error', () => {
          placeAutocomplete?.blur();
          setStatus('error');
          setMessage(
            'Place search is temporarily unavailable. You can still choose a point on the map.',
          );
          onSearchError?.();
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
        const initial = initialPositionRef.current;
        if (initial) {
          const latitude = Number(initial.latitude);
          const longitude = Number(initial.longitude);
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            void selectPosition({ lat: latitude, lng: longitude }, 17, 'initial');
          }
        }
        window.addEventListener('resize', resizeMap);
        window.addEventListener('orientationchange', resizeMap);
        mobileMap.addEventListener('change', resizeMap);
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
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', resizeMap);
      window.removeEventListener('orientationchange', resizeMap);
      mobileMap.removeEventListener('change', resizeMap);
      searchContainer.removeEventListener('focusin', handleFocusIn);
      searchContainer.removeEventListener('focusout', handleFocusOut);
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      if (marker.current)
        google.maps.event.clearInstanceListeners(marker.current);
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
    const requestVersion = ++selectionVersion.current;
    const selectCurrentPosition: PositionCallback = ({ coords }) => {
      if (requestVersion !== selectionVersion.current) return;
      void selectPosition({ lat: coords.latitude, lng: coords.longitude }, 18, 'current');
    };
    const showLocationError = (error: GeolocationPositionError) => {
      if (requestVersion !== selectionVersion.current) return;
      setStatus('error');
      if (error.code === error.PERMISSION_DENIED)
        setMessage(
          'Location permission was denied. Allow it in browser settings or choose a point on the map.',
        );
      else if (error.code === error.TIMEOUT)
        setMessage(
          'Location request timed out. Search for the venue or choose a point on the map.',
        );
      else
        setMessage(
          'Your current location is unavailable. Search or choose a point on the map instead.',
        );
    };
    navigator.geolocation.getCurrentPosition(
      selectCurrentPosition,
      (error) => {
        if (requestVersion !== selectionVersion.current) return;
        if (error.code === error.PERMISSION_DENIED) {
          showLocationError(error);
          return;
        }
        setMessage(
          'Precise location is taking longer. Trying a quicker check…',
        );
        navigator.geolocation.getCurrentPosition(
          selectCurrentPosition,
          showLocationError,
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm text-muted-foreground">
          Enter your address manually below.
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
    <div className="address-map-picker min-w-0 rounded-2xl border border-border bg-[hsl(var(--ivory))] p-2.5 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="map-search-shell relative z-20 flex min-h-12 min-w-0 flex-1 items-center overflow-visible rounded-xl border border-border bg-white shadow-sm transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center border-r border-border bg-muted/40 text-primary sm:flex">
            <Search className="h-4 w-4" />
          </span>
          <div
            ref={searchElement}
            className={`map-place-search min-h-12 min-w-0 flex-1 ${inlineMobileSearch ? 'max-md:hidden' : ''}`}
            aria-label="Search Google Maps"
          />
          {inlineMobileSearch && (
            <input
              type="search"
              value={searchQuery}
              disabled={!searchReady}
              placeholder={searchReady ? 'Search for an address or venue' : 'Loading search…'}
              aria-label="Search Google Maps"
              aria-controls="mobile-place-suggestions"
              aria-expanded={suggestions.length > 0}
              onFocus={() => {
                setSearchFocused(true);
                onSearchFocusChange?.(true);
              }}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSuggestions([]);
              }}
              className="h-12 w-full min-w-0 flex-1 rounded-xl bg-white px-3 text-base text-foreground outline-none placeholder:text-muted-foreground md:hidden"
            />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={useCurrentLocation}
          disabled={busy}
          className={`h-12 rounded-xl border-primary/25 bg-primary/[0.04] px-5 font-semibold text-primary shadow-sm hover:border-primary/40 hover:bg-primary/10 hover:text-primary ${searchFocused && !inlineMobileSearch ? 'max-md:hidden' : ''}`}
        >
          {status === 'locating' || status === 'geocoding' ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="mr-2 h-4 w-4" />
          )}
          {status === 'locating'
            ? 'Finding your location…'
            : status === 'geocoding'
              ? 'Checking location…'
              : 'Use my location'}
        </Button>
      </div>
      {(status === 'locating' || status === 'geocoding') && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-sm font-medium text-primary">
          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          {message}
        </p>
      )}
      {inlineMobileSearch && suggestions.length > 0 && (
        <div
          id="mobile-place-suggestions"
          className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-white shadow-sm md:hidden"
          role="listbox"
          aria-label="Matching locations"
        >
          {suggestions.map((suggestion) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return null;
            return (
              <button
                key={prediction.placeId}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => void selectPlace(prediction)}
                className="flex min-h-12 w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-primary/[0.05]"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <strong className="block font-semibold text-foreground">
                    {prediction.mainText?.text ?? prediction.text.text}
                  </strong>
                  {prediction.secondaryText?.text && (
                    <span className="block text-xs text-muted-foreground">
                      {prediction.secondaryText.text}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div
        className={`relative mt-3 overflow-hidden rounded-2xl border-2 border-white bg-muted shadow-[0_16px_40px_rgba(74,43,35,0.14)] ring-1 ring-border sm:border-4 ${searchFocused && !inlineMobileSearch ? 'max-md:hidden' : ''}`}
      >
        <div
          ref={mapElement}
          className="address-map-canvas h-[280px] w-full min-[390px]:h-[300px] sm:h-[420px]"
          aria-label="Choose address on Google Map"
        />
        <div className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-full border border-white/80 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-foreground shadow-md backdrop-blur sm:left-3 sm:top-3 sm:px-3 sm:py-2 sm:text-xs">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="sm:hidden">Tap the map or drag the pin</span>
          <span className="hidden sm:inline">
            Click the map or drag the pin
          </span>
        </div>
      </div>
      {message && status !== 'locating' && status !== 'geocoding' && (
        <div
          className={`mt-3 flex min-h-12 items-start gap-2 rounded-xl border px-3.5 py-3 text-sm leading-5 ${statusStyle} ${searchFocused && !inlineMobileSearch ? 'max-md:hidden' : ''}`}
          role="status"
        >
          {busy ? (
            <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : (
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          )}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
