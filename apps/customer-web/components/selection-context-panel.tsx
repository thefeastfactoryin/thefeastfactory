'use client';

import type { CartSummary, UserAddress } from '@aranyam/shared-types';
import { LocateFixed, MapPin } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useSessionStore } from '../store/session.store';
import { Button } from './ui/button';
import { Field, Select } from './ui/form';
import { Input } from './ui/input';

export function SelectionContextPanel({ packageVersionId, minPax, maxPax }: { packageVersionId: string; minPax: number; maxPax?: number | null }) {
  const session = useSessionStore((s) => s.session);
  const pkg = useOrderBuilderStore((s) => s.package);
  const setEvent = useOrderBuilderStore((s) => s.setEvent);
  const setDbCartId = useOrderBuilderStore((s) => s.setDbCartId);
  const setGuestCount = useOrderBuilderStore((s) => s.setGuestCount);
  const guestCount = useOrderBuilderStore((s) => s.guestCount);
  const pathname = usePathname();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [eventName, setEventName] = useState(pkg?.packageName ?? '');
  const [eventDate, setEventDate] = useState('');
  const [eventTimeStart, setEventTimeStart] = useState('');
  const [message, setMessage] = useState('Complete all required fields to autosave.');
  const [saving, setSaving] = useState(false);
  const hydrated = useRef(false);
  useEffect(() => setSelectedAddress(new URLSearchParams(window.location.search).get('addressId')), []);

  useEffect(() => { if (!eventName && pkg?.packageName) setEventName(pkg.packageName); }, [pkg?.packageName, eventName]);
  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiRequest<UserAddress[]>('/me/addresses', {}, session.accessToken),
      apiRequest<CartSummary | null>('/cart', {}, session.accessToken),
    ]).then(([rows, cart]) => {
      setAddresses(rows);
      setAddressId(selectedAddress || cart?.event?.address?.id || rows.find((row) => row.isDefault)?.id || rows[0]?.id || '');
      if (cart?.packageVersionId === packageVersionId && cart.event) {
        setEventName(cart.event.eventName || pkg?.packageName || '');
        setEventDate(cart.event.eventDate);
        setEventTimeStart(cart.event.eventTimeStart || '');
        setGuestCount(cart.event.guestCount);
      }
      hydrated.current = true;
    }).catch((error) => setMessage(error.message));
  }, [session, packageVersionId, selectedAddress, pkg?.packageName, setGuestCount]);

  useEffect(() => {
    const address = addresses.find((row) => row.id === addressId);
    setEvent({
      addressId: addressId || undefined,
      eventName: eventName.trim() || pkg?.packageName,
      eventDate: eventDate || undefined,
      eventTimeStart: eventTimeStart || undefined,
      addressLabel: address ? address.label || address.addressLine1 : undefined,
    });
  }, [addressId, addresses, eventName, eventDate, eventTimeStart, pkg?.packageName, setEvent]);

  useEffect(() => {
    if (!session || !hydrated.current) return;
    const validGuests = guestCount >= minPax && (!maxPax || guestCount <= maxPax);
    if (!addressId || !eventDate || !eventTimeStart || !validGuests) {
      setMessage('Venue, date, time, and a valid guest count are required.');
      return;
    }
    setMessage('Changes pending…');
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const cart = await apiRequest<CartSummary>('/cart', { method: 'PUT', body: JSON.stringify({ packageVersionId, addressId, eventName: eventName.trim() || pkg?.packageName, eventDate, eventTimeStart, guestCount }) }, session.accessToken);
        const address = addresses.find((row) => row.id === addressId)!;
        setDbCartId(cart.id);
        setEvent({ addressId, eventName: eventName.trim() || pkg?.packageName, eventDate, eventTimeStart, addressLabel: address.label || address.addressLine1 });
        setMessage('Saved to your cart.');
      } catch (error) { setMessage((error as Error).message); }
      finally { setSaving(false); }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [session, packageVersionId, addressId, eventName, eventDate, eventTimeStart, guestCount, minPax, maxPax, addresses, pkg?.packageName, setDbCartId, setEvent]);

  async function useCurrentLocation() {
    if (!session || !addressId) return;
    if (!navigator.geolocation) return setMessage('Current location is not supported by this browser.');
    setMessage('Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        await apiRequest(`/me/addresses/${addressId}`, { method: 'PATCH', body: JSON.stringify({ latitude: coords.latitude.toFixed(8), longitude: coords.longitude.toFixed(8) }) }, session.accessToken);
        setMessage('Current coordinates applied. Event details will autosave.');
      } catch (error) { setMessage((error as Error).message); }
    }, () => setMessage('Location permission was denied.'), { enableHighAccuracy: true, timeout: 10000 });
  }

  if (!session) return <section className="surface-card p-6"><p className="font-serif text-2xl font-semibold">Sign in to continue</p><p className="mt-2 text-sm text-muted-foreground">Your selection stays on this device while you verify your mobile number.</p><Link className="mt-4 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white" href={`/login?returnTo=${encodeURIComponent(pathname)}`}>Sign in</Link></section>;
  const returnTo = `${pathname}?addressId=ADDRESS_ID`;
  return <section className="surface-card p-5 sm:p-6" aria-labelledby="event-context-title"><div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /><h2 id="event-context-title" className="font-serif text-2xl font-semibold">Event and venue</h2></div><p className="mt-1 text-xs text-muted-foreground">These details save automatically.</p><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5"><Field label="Event name"><Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder={pkg?.packageName} /></Field><Field label="Date"><Input type="date" min={new Date().toISOString().slice(0, 10)} value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></Field><Field label="Time"><Input type="time" value={eventTimeStart} onChange={(e) => setEventTimeStart(e.target.value)} required /></Field><Field label="Pax"><Input type="number" min={minPax} max={maxPax ?? undefined} value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} required /></Field><Field label="Venue"><Select value={addressId} onChange={(e) => setAddressId(e.target.value)} required><option value="">Choose venue</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label || address.addressLine1}</option>)}</Select></Field></div><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={useCurrentLocation} disabled={!addressId}><LocateFixed className="mr-2 h-4 w-4" />Use my current location</Button><Link className="text-sm font-semibold text-primary" href={`/addresses?returnTo=${encodeURIComponent(returnTo)}`}>Add address</Link><p className="w-full text-sm text-muted-foreground" role="status">{saving ? 'Saving…' : message}</p></div></section>;
}
