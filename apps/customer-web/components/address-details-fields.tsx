'use client';

import { indianStateOptions, type AddressType } from '@aranyam/shared-types';
import { cn } from '../lib/utils';
import { Field, Select } from './ui/form';
import { Input } from './ui/input';

export type AddressDetailsValue = {
  addressType: AddressType;
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
};

function defaultAddressLabel(addressType: AddressType) {
  if (addressType === 'OFFICE') return 'Work';
  if (addressType === 'EVENT_VENUE') return 'Event venue';
  if (addressType === 'OTHER') return '';
  return 'Home';
}

export function AddressDetailsFields({
  value,
  onChange,
  className,
}: {
  value: AddressDetailsValue;
  onChange: (value: AddressDetailsValue) => void;
  className?: string;
}) {
  const update = (values: Partial<AddressDetailsValue>) =>
    onChange({ ...value, ...values });

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <Field label="Address type">
        <Select
          value={value.addressType}
          onChange={(event) => {
            const addressType = event.target.value as AddressType;
            const currentDefaultLabels = [
              'Home',
              'Work',
              'Office',
              'Event venue',
            ];
            update({
              addressType,
              label:
                !value.label || currentDefaultLabels.includes(value.label)
                  ? defaultAddressLabel(addressType)
                  : value.label,
            });
          }}
        >
          <option value="HOME">Home</option>
          <option value="OFFICE">Work</option>
          <option value="EVENT_VENUE">Event venue</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Address label" optional>
        <Input
          value={value.label}
          maxLength={50}
          placeholder="e.g. Home or event venue"
          onChange={(event) => update({ label: event.target.value })}
        />
      </Field>
      <Field label="House, building or street" className="sm:col-span-2">
        <Input
          value={value.addressLine1}
          maxLength={255}
          required
          onChange={(event) => update({ addressLine1: event.target.value })}
        />
      </Field>
      <Field label="Area / locality" optional>
        <Input
          value={value.addressLine2}
          maxLength={255}
          onChange={(event) => update({ addressLine2: event.target.value })}
        />
      </Field>
      <Field label="Landmark" optional>
        <Input
          value={value.landmark}
          maxLength={255}
          placeholder="Nearby landmark"
          onChange={(event) => update({ landmark: event.target.value })}
        />
      </Field>
      <Field label="City">
        <Input
          value={value.city}
          maxLength={100}
          required
          onChange={(event) => update({ city: event.target.value })}
        />
      </Field>
      <Field label="State">
        <Select
          value={value.state}
          required
          onChange={(event) => update({ state: event.target.value })}
        >
          <option value="">Select state</option>
          {value.state &&
            !indianStateOptions.includes(
              value.state as (typeof indianStateOptions)[number],
            ) && <option value={value.state}>{value.state}</option>}
          {indianStateOptions.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Pincode" className="sm:col-span-2">
        <Input
          value={value.pincode}
          inputMode="numeric"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          onChange={(event) =>
            update({ pincode: event.target.value.replace(/\D/g, '') })
          }
        />
      </Field>
    </div>
  );
}
