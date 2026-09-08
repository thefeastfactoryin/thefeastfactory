import type { LocationResolution } from '@aranyam/shared-types';
import { create } from 'zustand';

export type DeliveryLocationAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
};

export type DeliveryLocation = {
  latitude: string;
  longitude: string;
  label: string;
  source: 'browser' | 'saved' | 'manual';
  savedAddressId?: string;
  accuracyMeters?: number;
  address?: DeliveryLocationAddress;
  resolution: LocationResolution;
};

type DeliveryLocationState = {
  location?: DeliveryLocation;
  status: 'idle' | 'locating' | 'resolving' | 'ready' | 'error';
  error?: string;
  setStatus: (status: DeliveryLocationState['status']) => void;
  setLocation: (location: DeliveryLocation) => void;
  setError: (error: string) => void;
  reset: () => void;
};

export const useDeliveryLocationStore = create<DeliveryLocationState>()(
  (set) => ({
    status: 'idle',
    setStatus: (status) => set({ status, error: undefined }),
    setLocation: (location) =>
      set({ location, status: 'ready', error: undefined }),
    setError: (error) => set({ status: 'error', error }),
    reset: () => set({ location: undefined, status: 'idle', error: undefined }),
  }),
);

export function distanceBetweenKm(
  firstLatitude: string | number,
  firstLongitude: string | number,
  secondLatitude: string | number,
  secondLongitude: string | number,
) {
  const earthRadiusKm = 6371;
  const firstLat = toRadians(Number(firstLatitude));
  const secondLat = toRadians(Number(secondLatitude));
  const latitudeDelta = toRadians(
    Number(secondLatitude) - Number(firstLatitude),
  );
  const longitudeDelta = toRadians(
    Number(secondLongitude) - Number(firstLongitude),
  );
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
