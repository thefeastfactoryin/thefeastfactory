'use client';

import {
  indianStateOptions,
  type AddressType,
  type LocationResolution,
  type UserAddress,
} from '@aranyam/shared-types';
import { createAddressSchema } from '@aranyam/validation';
import { CheckCircle2, MapPin, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Checkbox, Field, Select } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { AuthRequiredPanel } from '../../components/ui/state-panel';
import { AddressMapPicker } from '../../components/address-map-picker';
import { apiRequest } from '../../lib/api';
import { useSessionStore } from '../../store/session.store';
import { safeReturnPath } from '../../lib/safe-return-path';
import { useDeliveryLocationStore } from '../../store/delivery-location.store';
import { useAddressBookStore } from '../../store/address-book.store';

const initialForm = {
  addressType: 'HOME' as AddressType,
  label: 'Home',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  latitude: '',
  longitude: '',
  isDefault: false,
};

export default function AddressesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'saved' | 'map'>('saved');
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const session = useSessionStore((state) => state.session);
  const deliveryLocation = useDeliveryLocationStore((state) => state.location);
  const setDeliveryLocation = useDeliveryLocationStore(
    (state) => state.setLocation,
  );
  const markAddressesChanged = useAddressBookStore(
    (state) => state.markChanged,
  );
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const destination = safeReturnPath(params.get('returnTo'), '') || null;
    setReturnTo(destination);
    setActiveTab(params.get('tab') === 'map' ? 'map' : 'saved');
    if (deliveryLocation) {
      setForm((current) => ({
        ...current,
        ...deliveryLocation.address,
        latitude: deliveryLocation.latitude,
        longitude: deliveryLocation.longitude,
      }));
    }
  }, []);

  function switchTab(tab: 'saved' | 'map') {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/addresses?${params.toString()}`, { scroll: false });
  }

  async function load() {
    if (!session) return;
    setLoading(true);
    try {
      setAddresses(
        await apiRequest<UserAddress[]>(
          '/me/addresses',
          {},
          session.accessToken,
        ),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session]);

  if (!session) {
    return (
      <AuthRequiredPanel
        title="Sign in to manage venues"
        description="Saved addresses make event planning faster and keep checkout from asking for venue details again."
        returnHref={`/addresses?tab=${activeTab}`}
      />
    );
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const result = createAddressSchema.safeParse({
      ...form,
      label: form.label.trim() || undefined,
      addressLine2: form.addressLine2.trim() || undefined,
      landmark: form.landmark.trim() || undefined,
      latitude: form.latitude || undefined,
      longitude: form.longitude || undefined,
    });
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? 'Please check the address details.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiRequest<UserAddress>(
        '/me/addresses',
        { method: 'POST', body: JSON.stringify(result.data) },
        session!.accessToken,
      );
      markAddressesChanged();
      if (created.latitude && created.longitude) {
        try {
          const resolution = await apiRequest<LocationResolution>(
            '/operating-regions/resolve',
            {
              method: 'POST',
              body: JSON.stringify({
                latitude: created.latitude,
                longitude: created.longitude,
              }),
            },
          );
          setDeliveryLocation({
            latitude: created.latitude,
            longitude: created.longitude,
            label:
              created.label ||
              created.addressLine2 ||
              created.addressLine1 ||
              created.city,
            source: 'saved',
            savedAddressId: created.id,
            address: {
              addressLine1: created.addressLine1,
              addressLine2: created.addressLine2 ?? undefined,
              city: created.city,
              state: created.state,
              pincode: created.pincode,
              landmark: created.landmark ?? undefined,
            },
            resolution,
          });
        } catch {
          // The address is safely stored even if the availability check is temporarily unavailable.
        }
      }
      setForm({ ...initialForm, isDefault: false });
      if (returnTo) {
        router.replace(returnTo.replace('ADDRESS_ID', created.id));
        return;
      }
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell pb-20">
      <div className="max-w-3xl">
        <p className="eyebrow">Your venues</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
          Venues & addresses
        </h1>
        <p className="mt-2 leading-6 text-muted-foreground">
          Save frequently used places or choose an exact event location on the
          map for faster planning.
        </p>
      </div>

      <div
        className="mt-6 inline-flex w-full rounded-xl border border-border bg-muted/60 p-1 sm:w-auto"
        role="tablist"
        aria-label="Venue options"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'saved'}
          onClick={() => switchTab('saved')}
          className={`flex-1 rounded-lg px-5 py-2.5 text-sm font-semibold transition sm:flex-none ${
            activeTab === 'saved'
              ? 'bg-white text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Saved addresses
          {addresses.length > 0 && (
            <span className="numeric-text ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {addresses.length}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'map'}
          onClick={() => switchTab('map')}
          className={`flex-1 rounded-lg px-5 py-2.5 text-sm font-semibold transition sm:flex-none ${
            activeTab === 'map'
              ? 'bg-primary text-white shadow-sm'
              : 'text-primary hover:bg-primary/10'
          }`}
        >
          Choose on map
        </button>
      </div>

      {activeTab === 'map' && (
        <div
          className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]"
          role="tabpanel"
        >
          <section className="surface-card p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl font-semibold">
                Find the exact location
              </h2>
              <p className="text-xs text-muted-foreground">
                Search, click, drag the pin, or use your location
              </p>
            </div>
            <AddressMapPicker
              initialPosition={
                deliveryLocation
                  ? {
                      latitude: deliveryLocation.latitude,
                      longitude: deliveryLocation.longitude,
                    }
                  : undefined
              }
              onAddress={(address) => {
                setError('');
                setForm((current) => ({ ...current, ...address }));
              }}
            />
          </section>

          <form onSubmit={add} className="surface-card h-fit p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-serif text-2xl font-semibold">
                  Address details
                </h2>
                <p className="text-xs text-muted-foreground">
                  Review the detected details before saving
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Field label="Address type">
                <Select
                  value={form.addressType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      addressType: event.target.value as AddressType,
                    })
                  }
                >
                  <option value="HOME">Home</option>
                  <option value="OFFICE">Office</option>
                  <option value="EVENT_VENUE">Event venue</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Label">
                <Input
                  placeholder="e.g. Home or Garden venue"
                  maxLength={50}
                  value={form.label}
                  onChange={(event) =>
                    setForm({ ...form, label: event.target.value })
                  }
                />
              </Field>
              <Field
                label="Address line 1"
                className="sm:col-span-2 lg:col-span-1"
              >
                <Input
                  placeholder="House, flat, building, or street"
                  maxLength={255}
                  value={form.addressLine1}
                  onChange={(event) =>
                    setForm({ ...form, addressLine1: event.target.value })
                  }
                  required
                />
              </Field>
              <Field
                label="Address line 2"
                optional
                className="sm:col-span-2 lg:col-span-1"
              >
                <Input
                  placeholder="Area or locality"
                  maxLength={255}
                  value={form.addressLine2}
                  onChange={(event) =>
                    setForm({ ...form, addressLine2: event.target.value })
                  }
                />
              </Field>
              <Field label="City">
                <Input
                  placeholder="City"
                  maxLength={100}
                  value={form.city}
                  onChange={(event) =>
                    setForm({ ...form, city: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="State">
                <Select
                  value={form.state}
                  onChange={(event) =>
                    setForm({ ...form, state: event.target.value })
                  }
                  required
                >
                  <option value="">Select state</option>
                  {form.state &&
                    !indianStateOptions.includes(
                      form.state as (typeof indianStateOptions)[number],
                    ) && <option value={form.state}>{form.state}</option>}
                  {indianStateOptions.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Pincode">
                <Input
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  value={form.pincode}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      pincode: event.target.value.replace(/\D/g, ''),
                    })
                  }
                  required
                />
              </Field>
              <Field label="Landmark" optional>
                <Input
                  placeholder="Nearby landmark"
                  maxLength={255}
                  value={form.landmark}
                  onChange={(event) =>
                    setForm({ ...form, landmark: event.target.value })
                  }
                />
              </Field>
            </div>

            <Checkbox
              className="mt-5"
              label="Make this my default address"
              description="We will preselect this venue when planning your next event."
              checked={form.isDefault}
              onCheckedChange={(checked) =>
                setForm({ ...form, isDefault: checked })
              }
            />

            {form.latitude && form.longitude && (
              <p className="mt-3 text-xs text-muted-foreground">
                Map pin: {Number(form.latitude).toFixed(5)},{' '}
                {Number(form.longitude).toFixed(5)}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <Button className="mt-5 w-full" disabled={submitting}>
              {submitting ? 'Saving address…' : 'Save address'}
            </Button>
          </form>
        </div>
      )}

      {activeTab === 'saved' && (
        <section className="mt-5" role="tabpanel">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold">
              Your saved places
            </h2>
            <span className="text-sm text-muted-foreground">
              {addresses.length} saved
            </span>
          </div>

          {loading ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-44 animate-pulse rounded-xl bg-white/60"
                />
              ))}
            </div>
          ) : addresses.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {addresses.map((address) => (
                <article key={address.id} className="surface-card p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <MapPin className="h-5 w-5" />
                    </span>
                    {address.isDefault && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Default
                      </span>
                    )}
                  </div>
                  <h3 className="mt-5 font-serif text-2xl font-semibold">
                    {address.label || address.addressType}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {address.addressLine1}
                    {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                    <br />
                    {address.city}, {address.state} {address.pincode}
                  </p>
                  {address.landmark && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Near {address.landmark}
                    </p>
                  )}
                  {returnTo && (
                    <Button
                      type="button"
                      className="mt-4 w-full"
                      onClick={() =>
                        router.replace(
                          returnTo.replace('ADDRESS_ID', address.id),
                        )
                      }
                    >
                      Select this address
                    </Button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="surface-card mt-5 p-8 text-center">
              <MapPin className="mx-auto h-7 w-7 text-primary" />
              <p className="mt-4 font-semibold">No saved addresses yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your first address becomes the default automatically.
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
