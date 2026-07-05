'use client';

import {
  indianStateOptions,
  type AddressType,
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
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const session = useSessionStore((state) => state.session);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(
    () =>
      setReturnTo(
        safeReturnPath(
          new URLSearchParams(window.location.search).get('returnTo'),
          '',
        ) || null,
      ),
    [],
  );

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
        returnHref="/addresses"
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
    <main className="page-shell pb-28">
      <div className="max-w-2xl">
        <p className="eyebrow">Your venues</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">
          Saved addresses
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Keep home, office, and event locations ready for faster planning.
        </p>
      </div>

      <section className="surface-card mt-8 p-5 sm:p-7">
        <div className="mb-5">
          <p className="eyebrow">Choose on map</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">
            Find the exact location
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Search for a venue, click anywhere, drag the pin, or use your
            current location. You can review and edit the detected address
            before saving.
          </p>
        </div>
        <AddressMapPicker
          onAddress={(address) => {
            setError('');
            setForm((current) => ({ ...current, ...address }));
          }}
        />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
        <form onSubmit={add} className="surface-card h-fit p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </span>
            <h2 className="font-serif text-2xl font-semibold">
              Add an address
            </h2>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
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

        <section>
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
      </div>
    </main>
  );
}
