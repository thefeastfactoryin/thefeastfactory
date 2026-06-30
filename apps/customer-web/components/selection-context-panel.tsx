'use client';

import type { CartSummary, UserAddress } from '@aranyam/shared-types';
import { ChevronDown, LocateFixed, MapPin } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api';
import { cn } from '../lib/utils';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useSessionStore } from '../store/session.store';
import { Button } from './ui/button';
import { Field, Select } from './ui/form';
import { Input } from './ui/input';

export function SelectionContextPanel({
  packageVersionId,
  minPax,
  maxPax,
  variant = 'default',
}: {
  packageVersionId: string;
  minPax: number;
  maxPax?: number | null;
  variant?: 'default' | 'sidebar';
}) {
  const sidebar = variant === 'sidebar';
  const session = useSessionStore((state) => state.session);
  const pkg = useOrderBuilderStore((state) => state.package);
  const setEvent = useOrderBuilderStore((state) => state.setEvent);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const setGuestCount = useOrderBuilderStore((state) => state.setGuestCount);
  const guestCount = useOrderBuilderStore((state) => state.guestCount);
  const pathname = usePathname();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [eventName, setEventName] = useState(pkg?.packageName ?? '');
  const [eventDate, setEventDate] = useState('');
  const [eventTimeStart, setEventTimeStart] = useState('');
  const [message, setMessage] = useState(
    'Complete all required fields to autosave.',
  );
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(!sidebar);
  const hydrated = useRef(false);

  useEffect(() => {
    setSelectedAddress(
      new URLSearchParams(window.location.search).get('addressId'),
    );
  }, []);

  useEffect(() => {
    if (!eventName && pkg?.packageName) setEventName(pkg.packageName);
  }, [pkg?.packageName, eventName]);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiRequest<UserAddress[]>('/me/addresses', {}, session.accessToken),
      apiRequest<CartSummary | null>('/cart', {}, session.accessToken),
    ])
      .then(([rows, cart]) => {
        setAddresses(rows);
        setAddressId(
          selectedAddress ||
            cart?.event?.address?.id ||
            rows.find((row) => row.isDefault)?.id ||
            rows[0]?.id ||
            '',
        );
        if (cart?.packageVersionId === packageVersionId && cart.event) {
          setEventName(cart.event.eventName || pkg?.packageName || '');
          setEventDate(cart.event.eventDate);
          setEventTimeStart(cart.event.eventTimeStart || '');
          setGuestCount(cart.event.guestCount);
        }
        hydrated.current = true;
      })
      .catch((reason) => setMessage(reason.message));
  }, [
    session,
    packageVersionId,
    selectedAddress,
    pkg?.packageName,
    setGuestCount,
  ]);

  useEffect(() => {
    const address = addresses.find((row) => row.id === addressId);
    setEvent({
      addressId: addressId || undefined,
      eventName: eventName.trim() || pkg?.packageName,
      eventDate: eventDate || undefined,
      eventTimeStart: eventTimeStart || undefined,
      addressLabel: address
        ? address.label || address.addressLine1
        : undefined,
    });
  }, [
    addressId,
    addresses,
    eventName,
    eventDate,
    eventTimeStart,
    pkg?.packageName,
    setEvent,
  ]);

  useEffect(() => {
    if (!session || !hydrated.current) return;
    const validGuests =
      guestCount >= minPax && (!maxPax || guestCount <= maxPax);
    if (!addressId || !eventDate || !eventTimeStart || !validGuests) {
      setMessage('Venue, date, time, and a valid guest count are required.');
      return;
    }
    setMessage('Changes pending…');
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const cart = await apiRequest<CartSummary>(
          '/cart',
          {
            method: 'PUT',
            body: JSON.stringify({
              packageVersionId,
              addressId,
              eventName: eventName.trim() || pkg?.packageName,
              eventDate,
              eventTimeStart,
              guestCount,
            }),
          },
          session.accessToken,
        );
        const address = addresses.find((row) => row.id === addressId)!;
        setDbCartId(cart.id);
        setEvent({
          addressId,
          eventName: eventName.trim() || pkg?.packageName,
          eventDate,
          eventTimeStart,
          addressLabel: address.label || address.addressLine1,
        });
        setMessage('Saved to your cart.');
      } catch (reason) {
        setMessage((reason as Error).message);
      } finally {
        setSaving(false);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    session,
    packageVersionId,
    addressId,
    eventName,
    eventDate,
    eventTimeStart,
    guestCount,
    minPax,
    maxPax,
    addresses,
    pkg?.packageName,
    setDbCartId,
    setEvent,
  ]);

  async function useCurrentLocation() {
    if (!session || !addressId) return;
    if (!navigator.geolocation) {
      setMessage('Current location is not supported by this browser.');
      return;
    }
    setMessage('Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await apiRequest(
            `/me/addresses/${addressId}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                latitude: coords.latitude.toFixed(8),
                longitude: coords.longitude.toFixed(8),
              }),
            },
            session.accessToken,
          );
          setMessage(
            'Current coordinates applied. Event details will autosave.',
          );
        } catch (reason) {
          setMessage((reason as Error).message);
        }
      },
      () => setMessage('Location permission was denied.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (!session) {
    return (
      <section className="surface-card p-5">
        <p className="font-serif text-xl font-semibold">Sign in to continue</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your selection stays on this device while you verify your mobile number.
        </p>
        <Link
          className="mt-4 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white"
          href={`/login?returnTo=${encodeURIComponent(pathname)}`}
        >
          Sign in
        </Link>
      </section>
    );
  }

  const returnTo = `${pathname}?addressId=ADDRESS_ID`;
  const fields = (
    <>
      <div
        className={cn(
          'mt-5 grid gap-4',
          sidebar ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-5',
        )}
      >
        <Field label="Event name">
          <Input
            value={eventName}
            onChange={(event) => setEventName(event.target.value)}
            placeholder={pkg?.packageName}
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
            required
          />
        </Field>
        <Field label="Time">
          <Input
            type="time"
            value={eventTimeStart}
            onChange={(event) => setEventTimeStart(event.target.value)}
            required
          />
        </Field>
        <Field label="Pax">
          <Input
            type="number"
            min={minPax}
            max={maxPax ?? undefined}
            value={guestCount}
            onChange={(event) => setGuestCount(Number(event.target.value))}
            required
          />
        </Field>
        <Field label="Venue">
          <Select
            value={addressId}
            onChange={(event) => setAddressId(event.target.value)}
            required
          >
            <option value="">Choose venue</option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.label || address.addressLine1}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={useCurrentLocation}
          disabled={!addressId}
          className={sidebar ? 'w-full' : undefined}
        >
          <LocateFixed className="mr-2 h-4 w-4" /> Use current location
        </Button>
        <Link
          className="text-sm font-semibold text-primary"
          href={`/addresses?returnTo=${encodeURIComponent(returnTo)}`}
        >
          Add address
        </Link>
        <p className="w-full text-xs leading-5 text-muted-foreground" role="status">
          {saving ? 'Saving…' : message}
        </p>
      </div>
    </>
  );

  return (
    <section
      className={cn('surface-card', sidebar ? 'p-4' : 'p-5 sm:p-6')}
      aria-labelledby="event-context-title"
    >
      <button
        type="button"
        disabled={!sidebar}
        onClick={() => sidebar && setExpanded((value) => !value)}
        className={cn(
          'flex w-full items-center gap-2 text-left',
          sidebar && 'cursor-pointer',
        )}
        aria-expanded={sidebar ? expanded : true}
      >
        <MapPin className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span
            id="event-context-title"
            className={cn(
              'block font-serif font-semibold',
              sidebar ? 'text-xl' : 'text-2xl',
            )}
          >
            Event and venue
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {eventDate && addressId ? 'Details added · autosaves' : 'Add details when ready'}
          </span>
        </span>
        {sidebar && (
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition',
              expanded && 'rotate-180',
            )}
          />
        )}
      </button>
      {(!sidebar || expanded) && fields}
    </section>
  );
}
