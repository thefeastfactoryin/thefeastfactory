'use client';

import {
  indianStateOptions,
  type AddressType,
  type LocationResolution,
  type UserAddress,
} from '@aranyam/shared-types';
import { createAddressSchema } from '@aranyam/validation';
import { CheckCircle2, MapPin } from 'lucide-react';
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
import { publicEnv } from '../../lib/public-env';

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
        description="Save venues for faster checkout."
        returnHref={`/addresses?tab=${activeTab}`}
      />
    );
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const result = createAddressSchema.safeParse({
      ...form,
      label:
        form.label.trim() ||
        ({ HOME: 'Home', OFFICE: 'Office', EVENT_VENUE: 'Event venue', OTHER: 'Other' }[
          form.addressType
        ] ?? undefined),
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
    <main className="page-shell pb-28 pt-4 sm:pb-12 sm:pt-6 lg:pb-12 lg:pt-8">
      <div className="max-w-3xl">
        <h1 className="font-sans text-lg font-semibold leading-6 tracking-normal sm:text-2xl">
          {activeTab === 'map' ? 'Add address' : 'Addresses'}
        </h1>
      </div>

      <div
        className="mt-2 grid h-12 w-full max-w-md grid-cols-2 rounded-lg border border-border bg-muted/60 p-0.5 sm:mt-3"
        role="tablist"
        aria-label="Venue options"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'saved'}
          onClick={() => switchTab('saved')}
          className={`min-h-11 rounded-md px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            activeTab === 'saved'
              ? 'bg-primary text-white shadow-sm'
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
          className={`min-h-11 rounded-md px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            activeTab === 'map'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {publicEnv.googleMapsApiKey ? 'Choose on map' : 'Add new'}
        </button>
      </div>

      {activeTab === 'map' && (
        <div
          className="mt-2 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_420px] sm:mt-3 lg:gap-5"
          role="tabpanel"
        >
          {publicEnv.googleMapsApiKey && (
            <section className="surface-card p-3 sm:p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-sans text-lg font-semibold">
                  Find your address
                </h2>
                <p className="hidden text-xs text-muted-foreground sm:block">
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
          )}

          <form
            onSubmit={add}
            className="address-form h-fit rounded-none border-0 bg-transparent p-0 shadow-none lg:surface-card lg:p-5"
          >

            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-3 lg:grid-cols-1 [&_input]:h-12 [&_input]:rounded-lg [&_input]:px-3.5 [&_select]:h-12 [&_select]:min-h-12 [&_select]:rounded-lg [&_select]:px-3.5 [&_textarea]:h-12 [&_textarea]:min-h-12 [&_textarea]:rounded-lg [&_textarea]:px-3.5 [&_label>span]:mb-1.5 [&_label>span]:text-sm [&_label>span]:font-medium">
              <Field label="Address type" className="col-span-2 lg:col-span-1">
                <Select
                  value={form.addressType}
                  onChange={(event) => {
                    const addressType = event.target.value as AddressType;
                    setForm({
                      ...form,
                      addressType,
                      label: addressType === 'OTHER' ? '' : form.label,
                    });
                  }}
                >
                  <option value="HOME">Home</option>
                  <option value="OFFICE">Work</option>
                  <option value="EVENT_VENUE">Event venue</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              {form.addressType === 'OTHER' && <Field label="Label" optional optionalInline className="col-span-2 lg:col-span-1">
                <Input
                  placeholder="e.g. Parents' home"
                  maxLength={50}
                  value={form.label}
                  onChange={(event) =>
                    setForm({ ...form, label: event.target.value })
                  }
                />
              </Field>}
              <Field
                label="Address"
                className="col-span-2 lg:col-span-1"
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
                label="Area / locality"
                optional
                optionalInline
                className="col-span-2 lg:col-span-1"
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
              <Field label="Landmark" optional optionalInline className="col-span-2 lg:col-span-1">
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
              className="mt-2 rounded-lg p-2"
              label="Make this my default address"
              checked={form.isDefault}
              onCheckedChange={(checked) =>
                setForm({ ...form, isDefault: checked })
              }
            />

            {form.latitude && form.longitude && (
              <p className="mt-2 text-xs text-emerald-700">
                Location pinned
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <Button className="mt-3 hidden w-full rounded-xl lg:inline-flex" disabled={submitting}>
              {submitting ? 'Saving address…' : 'Save address'}
            </Button>
          </form>
        </div>
      )}

      {activeTab === 'saved' && (
        <section className="mt-5" role="tabpanel">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-lg font-semibold">
              Your saved places
            </h2>
            <span className="text-sm text-muted-foreground">
              {addresses.length} saved
            </span>
          </div>

          {loading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                <article key={address.id} className="surface-card p-4">
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
                  <h3 className="mt-3 font-sans text-lg font-semibold">
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
            <div className="surface-card mt-4 p-6 text-center">
              <MapPin className="mx-auto h-7 w-7 text-primary" />
              <p className="mt-4 font-semibold">No saved addresses yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your first address becomes the default automatically.
              </p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'map' && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-card/95 px-3 py-2 shadow-[0_-3px_10px_rgba(45,31,20,0.05)] backdrop-blur lg:hidden">
          <Button
            type="button"
            className="mx-auto h-12 w-full max-w-2xl rounded-xl"
            disabled={submitting}
            onClick={() => document.querySelector<HTMLFormElement>('form')?.requestSubmit()}
          >
            {submitting ? 'Saving address...' : 'Save address'}
          </Button>
        </div>
      )}
    </main>
  );
}
