'use client';

import type {
  CartSummary,
  OperatingRegion,
  UserAddress,
} from '@aranyam/shared-types';
import {
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  MapPinned,
  Minus,
  Plus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../lib/api';
import { cn } from '../lib/utils';
import { useDeliveryLocationStore } from '../store/delivery-location.store';
import { useAddressBookStore } from '../store/address-book.store';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useSessionStore } from '../store/session.store';
import { Field } from './ui/form';
import { usePublicSettings } from './public-settings-provider';

type DeliveryTimeSlot = { value: string; label: string };

function buildDeliveryTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
) {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const interval = Math.max(1, intervalMinutes);
  const count = Math.max(0, Math.floor((end - start) / interval) + 1);
  return Array.from({ length: count }, (_, index) => {
    const totalMinutes = start + index * interval;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return {
      value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      label: `${displayHour}:${String(minute).padStart(2, '0')} ${period}`,
    };
  });
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
}

function formatDateLabel(value: string) {
  const date = parseDateValue(value);
  return date
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)
    : 'Choose a date';
}

function usePopoverDismiss(
  open: boolean,
  onClose: () => void,
  ref: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose, ref]);
}

function ThemedDatePicker({
  value,
  min,
  onChange,
}: {
  value: string;
  min: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const initialDate = parseDateValue(value || min) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(open, () => setOpen(false), containerRef);

  useEffect(() => {
    const selected = parseDateValue(value);
    if (selected) {
      setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [value]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(visibleMonth);
  const previousMonthEnd = localDateValue(new Date(year, month, 0));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 rounded-xl border border-input bg-white/95 px-3 py-2 text-left text-sm outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30',
          open && 'border-primary/50 ring-2 ring-primary/15',
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/[0.07] text-primary">
          <CalendarDays className="h-4 w-4" />
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 font-semibold',
            !value && 'font-normal text-muted-foreground',
          )}
        >
          {formatDateLabel(value)}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose delivery date"
          className="absolute left-0 z-40 mt-2 w-80 max-w-[calc(100vw-64px)] rounded-2xl border bg-white p-4 shadow-[0_20px_55px_-24px_rgba(75,12,23,.45)]"
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Previous month"
              disabled={previousMonthEnd < min}
              onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full text-primary transition hover:bg-primary/[0.07] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <strong className="font-serif text-lg">{monthLabel}</strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full text-primary transition hover:bg-primary/[0.07]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day} className="py-1.5">
                {day.slice(0, 1)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => {
              const day = index - startOffset + 1;
              if (day < 1 || day > daysInMonth)
                return <span key={index} className="h-9" />;
              const dateValue = localDateValue(new Date(year, month, day));
              const disabled = dateValue < min;
              const selected = dateValue === value;
              const today = dateValue === min;
              return (
                <button
                  key={dateValue}
                  type="button"
                  disabled={disabled}
                  aria-label={new Intl.DateTimeFormat('en-IN', {
                    dateStyle: 'long',
                  }).format(new Date(year, month, day))}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(dateValue);
                    setOpen(false);
                  }}
                  className={cn(
                    'relative grid h-9 place-items-center rounded-full text-sm transition hover:bg-primary/[0.07] disabled:text-muted-foreground/35',
                    today && !selected && 'font-bold text-primary',
                    selected &&
                      'bg-primary font-bold text-white shadow-sm hover:bg-primary',
                  )}
                >
                  {day}
                  {today && !selected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemedTimePicker({
  value,
  onChange,
  slots,
}: {
  value: string;
  onChange: (value: string) => void;
  slots: DeliveryTimeSlot[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(open, () => setOpen(false), containerRef);
  const selectedSlot = slots.find((slot) => slot.value === value);
  const groups = [
    {
      label: 'Morning',
      slots: slots.filter((slot) => slot.value < '12:00'),
    },
    {
      label: 'Afternoon',
      slots: slots.filter(
        (slot) => slot.value >= '12:00' && slot.value < '18:00',
      ),
    },
    {
      label: 'Evening',
      slots: slots.filter((slot) => slot.value >= '18:00'),
    },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 rounded-xl border border-input bg-white/95 px-3 py-2 text-left text-sm outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30',
          open && 'border-primary/50 ring-2 ring-primary/15',
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/[0.07] text-primary">
          <Clock3 className="h-4 w-4" />
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 font-semibold',
            !value && 'font-normal text-muted-foreground',
          )}
        >
          {selectedSlot?.label || value || 'Choose a time'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose delivery time"
          className="absolute left-0 z-40 mt-2 max-h-80 w-80 max-w-[calc(100vw-64px)] overflow-y-auto rounded-2xl border bg-white p-3 shadow-[0_20px_55px_-24px_rgba(75,12,23,.45)]"
        >
          {value && !selectedSlot && (
            <button
              type="button"
              role="option"
              aria-selected="true"
              onClick={() => setOpen(false)}
              className="mb-3 w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white"
            >
              Previously saved · {value}
            </button>
          )}
          {groups.map((group, groupIndex) => (
            <section
              key={group.label}
              className={cn(groupIndex > 0 && 'mt-4 border-t pt-4')}
            >
              <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {group.slots.map((slot) => {
                  const selected = slot.value === value;
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(slot.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-primary/[0.05]',
                        selected &&
                          'border-primary bg-primary text-white hover:bg-primary',
                      )}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function SelectionContextPanel({
  cartId,
  packageVersionId,
  minPax,
  maxPax,
  variant = 'default',
  hideQuantity = false,
  onSaved,
}: {
  cartId: string;
  packageVersionId: string;
  minPax: number;
  maxPax?: number | null;
  variant?: 'default' | 'sidebar';
  hideQuantity?: boolean;
  onSaved?: (cart: CartSummary) => void;
}) {
  const sidebar = variant === 'sidebar';
  const publicSettings = usePublicSettings();
  const session = useSessionStore((state) => state.session);
  const deliveryLocation = useDeliveryLocationStore((state) => state.location);
  const addressBookRevision = useAddressBookStore((state) => state.revision);
  const pkg = useOrderBuilderStore((state) => state.package);
  const setEvent = useOrderBuilderStore((state) => state.setEvent);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const setGuestCount = useOrderBuilderStore((state) => state.setGuestCount);
  const guestCount = useOrderBuilderStore((state) => state.guestCount);
  const pathname = usePathname();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [assignedRegion, setAssignedRegion] = useState<OperatingRegion | null>(
    null,
  );
  const [addressId, setAddressId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTimeStart, setEventTimeStart] = useState('');
  const [message, setMessage] = useState(
    'Complete all required fields to autosave.',
  );
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(!sidebar);
  const [guestInput, setGuestInput] = useState(String(guestCount));
  const hydrated = useRef(false);
  const onSavedRef = useRef(onSaved);
  const lastSavedKey = useRef('');

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => setGuestInput(String(guestCount)), [guestCount]);

  function commitGuestCount(value: string) {
    const parsed = Number(value);
    const next = Math.min(
      Math.max(
        Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : minPax,
        minPax,
      ),
      maxPax ?? Number.MAX_SAFE_INTEGER,
    );
    setGuestCount(next);
    setGuestInput(String(next));
  }

  useEffect(() => {
    setSelectedAddress(
      new URLSearchParams(window.location.search).get('addressId'),
    );
  }, []);

  useEffect(() => {
    if (!session) return;
    let current = true;
    Promise.all([
      apiRequest<UserAddress[]>('/me/addresses', {}, session.accessToken),
      apiRequest<CartSummary | null>(
        `/cart/${cartId}`,
        {},
        session.accessToken,
      ),
    ])
      .then(([rows, cart]) => {
        if (!current) return;
        setAddresses(rows);
        const savedAddressId =
          cart?.event?.address?.id ?? cart?.address?.id ?? '';
        const nextAddressId =
          selectedAddress ||
          savedAddressId ||
          deliveryLocation?.savedAddressId ||
          (!deliveryLocation
            ? rows.find((row) => row.isDefault)?.id || rows[0]?.id
            : '') ||
          '';
        setAddressId(nextAddressId);
        if (cart?.packageVersionId === packageVersionId && cart.event) {
          setEventDate(cart.event.eventDate);
          setEventTimeStart(cart.event.eventTimeStart || '');
          setGuestCount(cart.event.guestCount);
          setAssignedRegion(cart.event.region ?? cart.region ?? null);
        } else {
          setEventDate('');
          setEventTimeStart('');
          setAssignedRegion(
            cart?.region ?? deliveryLocation?.resolution.region ?? null,
          );
        }
        if (savedAddressId && nextAddressId === savedAddressId) {
          lastSavedKey.current = [
            cartId,
            packageVersionId,
            savedAddressId,
            cart?.event?.eventDate ?? '',
            cart?.event?.eventTimeStart ?? '',
            cart?.event?.guestCount ?? cart?.guestCount ?? minPax,
          ].join(':');
        }
        hydrated.current = true;
      })
      .catch((reason) => {
        if (current) setMessage(reason.message);
      });
    return () => {
      current = false;
    };
  }, [
    session,
    cartId,
    packageVersionId,
    selectedAddress,
    deliveryLocation,
    addressBookRevision,
    pkg?.packageName,
    minPax,
    setGuestCount,
  ]);

  useEffect(() => {
    const address = addresses.find((row) => row.id === addressId);
    setEvent({
      addressId: addressId || undefined,
      eventName: pkg?.packageName,
      eventDate: eventDate || undefined,
      eventTimeStart: eventTimeStart || undefined,
      addressLabel: address ? address.label || address.addressLine1 : undefined,
    });
  }, [
    addressId,
    addresses,
    eventDate,
    eventTimeStart,
    pkg?.packageName,
    setEvent,
  ]);

  useEffect(() => {
    if (!session || !hydrated.current) return;
    const validGuests =
      guestCount >= minPax && (!maxPax || guestCount <= maxPax);
    if (!addressId) {
      setMessage('Choose a delivery venue.');
      return;
    }
    const completeEvent = Boolean(
      eventDate && eventTimeStart && validGuests,
    );
    const saveKey = [
      cartId,
      packageVersionId,
      addressId,
      eventDate,
      eventTimeStart,
      guestCount,
    ].join(':');
    if (saveKey === lastSavedKey.current) return;
    setMessage('Changes pending…');
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const cart = await apiRequest<CartSummary>(
          `/cart/${cartId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              packageVersionId,
              addressId,
              ...(completeEvent
                ? {
                    eventName: pkg?.packageName,
                    eventDate,
                    eventTimeStart,
                    guestCount,
                  }
                : {}),
            }),
          },
          session.accessToken,
        );
        const address = addresses.find((row) => row.id === addressId)!;
        setDbCartId(cart.id);
        setEvent({
          addressId,
          eventName: pkg?.packageName,
          eventDate,
          eventTimeStart,
          addressLabel: address.label || address.addressLine1,
        });
        setAssignedRegion(cart.event?.region ?? cart.region ?? null);
        lastSavedKey.current = saveKey;
        onSavedRef.current?.(cart);
        setMessage(
          completeEvent
            ? 'Saved to your cart.'
            : 'Address saved. Add the delivery date and time to continue.',
        );
      } catch (reason) {
        setMessage((reason as Error).message);
      } finally {
        setSaving(false);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    session,
    packageVersionId,
    cartId,
    addressId,
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

  if (!session) {
    return (
      <section className="surface-card p-5">
        <p className="font-serif text-xl font-semibold">Sign in to continue</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your selection stays on this device while you verify your mobile
          number.
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
  const earliestDate = new Date(
    Date.now() + (publicSettings?.minBookingLeadHours ?? 48) * 60 * 60 * 1000,
  );
  const firstEventDate = localDateValue(earliestDate);
  const deliveryTimeSlots = useMemo(
    () =>
      buildDeliveryTimeSlots(
        publicSettings?.eventServiceStartTime ?? '06:00',
        publicSettings?.eventServiceEndTime ?? '23:30',
        publicSettings?.eventTimeIntervalMinutes ?? 30,
      ),
    [publicSettings],
  );
  const selectedVenue = addresses.find((address) => address.id === addressId);
  const kitchenName = assignedRegion
    ? `${assignedRegion.name} Kitchen`
    : 'Kitchen will be assigned from delivery venue';
  const kitchenAddress =
    assignedRegion?.kitchenAddress ??
    'The preparation kitchen address will appear after the venue is saved.';
  const guestLabel = pkg?.packageType === 'MEAL_BOX' ? 'Boxes' : 'Guests';
  const addressIcon = (address: UserAddress) => {
    if (address.addressType === 'HOME') return Home;
    if (address.addressType === 'OFFICE') return Building2;
    if (address.addressType === 'EVENT_VENUE') return MapPinned;
    return MapPin;
  };
  const fields = (
    <>
      <div
        className={cn(
          'mt-5 grid gap-4 rounded-2xl border border-border bg-[#fcfaf6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
          sidebar
            ? 'grid-cols-1'
            : hideQuantity
              ? 'md:grid-cols-2'
              : 'md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_224px]',
        )}
      >
        <Field label="Delivery date" hint="Choose the event day.">
          <ThemedDatePicker
            min={firstEventDate}
            value={eventDate}
            onChange={setEventDate}
          />
        </Field>
        <Field
          label="Delivery time"
          hint={`Available every ${publicSettings?.eventTimeIntervalMinutes ?? 30} minutes.`}
        >
          <ThemedTimePicker
            value={eventTimeStart}
            onChange={setEventTimeStart}
            slots={deliveryTimeSlots}
          />
        </Field>
        {!hideQuantity && (
          <div>
            <span className="mb-2 block text-sm font-semibold">
              {guestLabel}
            </span>
            <div className="flex min-h-12 items-center justify-between rounded-xl border bg-white px-2">
              <button
                type="button"
                aria-label={`Decrease ${guestLabel.toLowerCase()}`}
                onClick={() => commitGuestCount(String(guestCount - 1))}
                disabled={guestCount <= minPax}
                className="grid h-9 w-9 place-items-center rounded-lg text-primary transition hover:bg-primary/5 disabled:opacity-35"
              >
                <Minus className="h-4 w-4" />
              </button>
              <label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="sr-only">{guestLabel}</span>
                <input
                  inputMode="numeric"
                  value={guestInput}
                  onChange={(event) =>
                    setGuestInput(event.target.value.replace(/\D/g, ''))
                  }
                  onBlur={() => commitGuestCount(guestInput)}
                  className="w-16 bg-transparent text-center font-serif text-xl font-semibold outline-none"
                  required
                />
              </label>
              <button
                type="button"
                aria-label={`Increase ${guestLabel.toLowerCase()}`}
                onClick={() => commitGuestCount(String(guestCount + 1))}
                disabled={Boolean(maxPax && guestCount >= maxPax)}
                className="grid h-9 w-9 place-items-center rounded-lg text-primary transition hover:bg-primary/5 disabled:opacity-35"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {minPax} minimum{maxPax ? ` · ${maxPax} maximum` : ''}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-4 text-muted-foreground">
        <p className="text-xs font-bold uppercase tracking-[0.14em]">
          Kitchen location
        </p>
        <p className="mt-2 text-sm font-bold text-foreground/60">
          {kitchenName}
        </p>
        <p className="mt-1 text-xs leading-5">{kitchenAddress}</p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold">Delivery venue</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedVenue
              ? selectedVenue.isDefault
                ? 'Your default saved address is selected automatically'
                : 'Saved address selected'
              : deliveryLocation
                ? 'Complete the address details for the location selected on the home page'
                : 'Choose one of your saved addresses'}
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          href={`/addresses?tab=map&returnTo=${encodeURIComponent(returnTo)}`}
        >
          <Plus className="h-4 w-4" />
          {deliveryLocation && !deliveryLocation.savedAddressId
            ? 'Complete address'
            : 'Add new address'}
        </Link>
      </div>

      {deliveryLocation && !deliveryLocation.savedAddressId && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">{deliveryLocation.label}</p>
          <p className="mt-1 text-xs leading-5">
            Your map location is ready. Add the house, building or venue details
            before checkout so the kitchen receives an exact delivery address.
          </p>
        </div>
      )}

      {addresses.length > 0 ? (
        <div
          className={cn(
            'mt-3 grid gap-3',
            sidebar ? 'grid-cols-1' : 'sm:grid-cols-2',
          )}
          role="radiogroup"
          aria-label="Choose delivery venue"
        >
          {addresses.map((address) => {
            const Icon = addressIcon(address);
            const selected = address.id === addressId;
            return (
              <button
                key={address.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAddressId(address.id)}
                className={cn(
                  'relative flex min-h-24 items-start gap-3 rounded-xl border bg-white p-4 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  selected &&
                    'border-primary bg-primary/[0.045] ring-1 ring-primary/20',
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground',
                    selected && 'bg-primary text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 pr-6">
                    <strong className="truncate text-sm">
                      {address.label ||
                        address.addressType.toLowerCase().replace('_', ' ')}
                    </strong>
                    {address.isDefault && (
                      <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {address.addressLine1}
                    {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                    <br />
                    {address.city}, {address.state} {address.pincode}
                  </span>
                </span>
                {selected && (
                  <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <Link
          href={`/addresses?tab=map&returnTo=${encodeURIComponent(returnTo)}`}
          className="mt-3 flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-[#fcfaf6] p-5 text-center text-sm font-semibold text-primary transition hover:border-primary/40"
        >
          <MapPinned className="h-5 w-5" />
          <span>No delivery address added</span>
          <span className="text-xs font-medium text-muted-foreground">
            Add a venue where the food should be delivered.
          </span>
        </Link>
      )}

      <div className="mt-4 border-t pt-4">
        <p
          className="flex min-w-0 items-center gap-2 text-xs leading-5 text-muted-foreground"
          role="status"
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
          {saving ? 'Saving…' : message}
        </p>
      </div>
    </>
  );

  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-white shadow-[0_14px_36px_-30px_rgba(75,12,23,.55)]',
        sidebar ? 'p-4' : 'p-5 sm:p-6',
      )}
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
            Delivery details
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Choose when and where we should deliver.
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
