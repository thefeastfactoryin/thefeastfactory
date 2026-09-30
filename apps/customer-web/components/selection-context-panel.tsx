'use client';

import type {
  CartSummary,
  LocationResolution,
  OperatingRegion,
  UserAddress,
} from '@aranyam/shared-types';
import { createAddressSchema } from '@aranyam/validation';
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
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../lib/api';
import { isClearedCartError } from '../lib/cart-state';
import { cn } from '../lib/utils';
import {
  useDeliveryLocationStore,
  type DeliveryLocation,
} from '../store/delivery-location.store';
import { useAddressBookStore } from '../store/address-book.store';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useSessionStore } from '../store/session.store';
import { Field } from './ui/form';
import { usePublicSettings } from './public-settings-provider';

type DeliveryTimeSlot = { value: string; label: string };

function addressIcon(address: UserAddress) {
  if (address.addressType === 'HOME') return Home;
  if (address.addressType === 'OFFICE') return Building2;
  if (address.addressType === 'EVENT_VENUE') return MapPinned;
  return MapPin;
}

function matchingSavedAddress(
  addresses: UserAddress[],
  location: DeliveryLocation,
) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const addressLine1 = location.address?.addressLine1.trim().toLowerCase();
  const pincode = location.address?.pincode.trim();
  return addresses.find((address) => {
    if (!address.latitude || !address.longitude) return false;
    return (
      Math.abs(Number(address.latitude) - latitude) < 0.00001 &&
      Math.abs(Number(address.longitude) - longitude) < 0.00001 &&
      address.addressLine1.trim().toLowerCase() === addressLine1 &&
      address.pincode.trim() === pincode
    );
  });
}

function AddressChooser({
  open,
  addresses,
  selectedAddressId,
  onClose,
  onSelect,
  onAddAddress,
}: {
  open: boolean;
  addresses: UserAddress[];
  selectedAddressId: string;
  onClose: () => void;
  onSelect: (addressId: string) => void;
  onAddAddress?: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      0,
    );
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeys);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleDialogKeys);
      returnFocus?.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end bg-slate-950/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close saved addresses"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-addresses-title"
        className="relative flex max-h-[min(78dvh,680px)] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2
              id="saved-addresses-title"
              className="font-sans text-lg font-semibold text-foreground"
            >
              Choose delivery address
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Select where you want this order delivered.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Close address chooser"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
          role="radiogroup"
          aria-label="Saved delivery addresses"
        >
          <div className="grid gap-2">
            {addresses.map((address) => {
              const Icon = addressIcon(address);
              const selected = address.id === selectedAddressId;
              return (
                <button
                  key={address.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(address.id)}
                  className={cn(
                    'flex min-h-20 w-full items-start gap-3 rounded-xl border border-border/70 bg-white p-3 text-left transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    selected &&
                      'border-primary/50 bg-primary/[0.045] ring-1 ring-primary/10',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground',
                      selected && 'bg-primary text-white',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <strong className="truncate text-sm font-semibold text-foreground">
                        {address.label ||
                          address.addressType.toLowerCase().replace('_', ' ')}
                      </strong>
                      {address.isDefault && (
                        <span className="shrink-0 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                          Default
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {[address.addressLine1, address.addressLine2]
                        .filter(Boolean)
                        .join(', ')}
                      <br />
                      {[address.city, address.state, address.pincode]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border bg-white',
                      selected && 'border-primary bg-primary text-white',
                    )}
                    aria-hidden="true"
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="shrink-0 border-t border-border/70 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddAddress?.();
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.045] px-4 text-sm font-semibold text-primary transition hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a new address
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export type VenueServiceability =
  | 'checking'
  | 'serviceable'
  | 'outside'
  | 'closed'
  | 'missing-pin'
  | 'missing'
  | 'error';

export type CheckoutFieldState = {
  hasAddress: boolean;
  hasCoordinates: boolean;
  hasDate: boolean;
  hasTime: boolean;
  saving: boolean;
};

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
  compact = false,
  invalid = false,
  popoverDirection = 'down',
}: {
  value: string;
  min: string;
  onChange: (value: string) => void;
  compact?: boolean;
  invalid?: boolean;
  popoverDirection?: 'up' | 'down';
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
        aria-label="Choose delivery date"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'cart-delivery-date-error' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          compact
            ? 'flex min-h-10 w-full min-w-0 items-center gap-1.5 rounded-md border border-input bg-white/90 px-2 py-1 text-left text-xs outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30'
            : 'flex min-h-12 w-full items-center gap-3 rounded-xl border border-input bg-white/95 px-3 py-2 text-left text-sm outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30',
          open && 'border-primary/50 ring-2 ring-primary/15',
          invalid &&
            'border-red-500 bg-red-50/70 ring-2 ring-red-200 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]',
        )}
      >
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-md bg-primary/[0.06] text-primary',
            compact ? 'h-6 w-6' : 'h-8 w-8 rounded-lg bg-primary/[0.07]',
          )}
        >
          <CalendarDays className="h-4 w-4" />
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 font-semibold',
            compact && 'truncate whitespace-nowrap',
            !value && 'font-normal text-muted-foreground',
          )}
        >
          {compact && !value
            ? 'Choose date'
            : compact && value
              ? new Intl.DateTimeFormat('en-IN', {
                  day: 'numeric',
                  month: 'short',
                }).format(parseDateValue(value) ?? new Date(value))
              : formatDateLabel(value)}
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
          className={cn(
            'absolute left-0 z-40 w-80 max-w-[calc(100vw-64px)] rounded-2xl border bg-white p-4 shadow-[0_20px_55px_-24px_rgba(75,12,23,.45)]',
            popoverDirection === 'up' ? 'bottom-full mb-2' : 'mt-2',
          )}
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
            <strong className="font-sans text-lg font-semibold">
              {monthLabel}
            </strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full text-primary transition hover:bg-primary/[0.07]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-bold text-muted-foreground">
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
  isSlotAvailable,
  compact = false,
  invalid = false,
  popoverDirection = 'down',
}: {
  value: string;
  onChange: (value: string) => void;
  slots: DeliveryTimeSlot[];
  isSlotAvailable: (slot: DeliveryTimeSlot) => boolean;
  compact?: boolean;
  invalid?: boolean;
  popoverDirection?: 'up' | 'down';
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
        aria-label="Choose delivery time"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'cart-delivery-time-error' : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          compact
            ? 'flex min-h-10 w-full min-w-0 items-center gap-1.5 rounded-md border border-input bg-white/90 px-2 py-1 text-left text-xs outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30'
            : 'flex min-h-12 w-full items-center gap-3 rounded-xl border border-input bg-white/95 px-3 py-2 text-left text-sm outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30',
          open && 'border-primary/50 ring-2 ring-primary/15',
          invalid &&
            'border-red-500 bg-red-50/70 ring-2 ring-red-200 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]',
        )}
      >
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-md bg-primary/[0.06] text-primary',
            compact ? 'h-6 w-6' : 'h-8 w-8 rounded-lg bg-primary/[0.07]',
          )}
        >
          <Clock3 className="h-4 w-4" />
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 font-semibold',
            compact && 'truncate whitespace-nowrap',
            !value && 'font-normal text-muted-foreground',
          )}
        >
          {selectedSlot?.label ||
            value ||
            (compact ? 'Choose time' : 'Choose a time')}
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
          className={cn(
            'absolute z-40 max-h-[min(28rem,calc(100dvh-12rem))] w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border bg-white p-3 shadow-[0_20px_55px_-24px_rgba(75,12,23,.45)]',
            compact ? 'right-0' : 'left-0',
            popoverDirection === 'up' ? 'bottom-full mb-2' : 'mt-2',
          )}
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
              <p className="mb-2 px-1 text-[10px] font-extrabold text-primary">
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {group.slots.map((slot) => {
                  const selected = slot.value === value;
                  const available = isSlotAvailable(slot);
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={!available}
                      disabled={!available}
                      onClick={() => {
                        onChange(slot.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-primary/[0.05] disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground/40',
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

function ScheduleChooser({
  open,
  date,
  time,
  minDate,
  slots,
  isSlotAvailable,
  saving,
  onDateChange,
  onTimeChange,
  onClose,
}: {
  open: boolean;
  date: string;
  time: string;
  minDate: string;
  slots: DeliveryTimeSlot[];
  isSlotAvailable: (slot: DeliveryTimeSlot) => boolean;
  saving: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      0,
    );
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeys);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleDialogKeys);
      returnFocus?.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end bg-slate-950/55 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close delivery schedule"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-schedule-title"
        className="relative w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
        <header className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2
              id="delivery-schedule-title"
              className="font-sans text-lg font-semibold text-foreground"
            >
              Change delivery date &amp; time
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choose when your order should arrive.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Close schedule chooser"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 px-4 py-5 max-[340px]:grid-cols-1 sm:px-5">
          <Field label="Delivery date">
            <ThemedDatePicker
              min={minDate}
              value={date}
              onChange={onDateChange}
              popoverDirection="up"
            />
          </Field>
          <Field label="Delivery time">
            <ThemedTimePicker
              value={time}
              onChange={onTimeChange}
              slots={slots}
              isSlotAvailable={isSlotAvailable}
              popoverDirection="up"
            />
          </Field>
        </div>

        <footer className="border-t border-border/70 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl sm:p-4">
          <button
            type="button"
            disabled={!date || !time}
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {saving ? 'Saving…' : 'Done'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export function SelectionContextPanel({
  cartId,
  packageVersionId,
  minPax,
  maxPax,
  variant = 'default',
  hideQuantity = false,
  checkoutCompact = false,
  deliveryService,
  onSaved,
  onAddAddress,
  onVenueStatusChange,
  onCheckoutStateChange,
  checkoutFieldError,
  onMissingCart,
}: {
  cartId: string;
  packageVersionId: string;
  minPax: number;
  maxPax?: number | null;
  variant?: 'default' | 'sidebar';
  hideQuantity?: boolean;
  checkoutCompact?: boolean;
  deliveryService?: ReactNode;
  onSaved?: (cart: CartSummary) => void;
  onAddAddress?: () => void;
  onVenueStatusChange?: (status: VenueServiceability) => void;
  onCheckoutStateChange?: (state: CheckoutFieldState) => void;
  checkoutFieldError?: {
    field: 'address' | 'date' | 'time';
    message: string;
  };
  onMissingCart?: () => void;
}) {
  const sidebar = variant === 'sidebar';
  const publicSettings = usePublicSettings();
  const session = useSessionStore((state) => state.session);
  const deliveryLocation = useDeliveryLocationStore((state) => state.location);
  const setDeliveryLocation = useDeliveryLocationStore(
    (state) => state.setLocation,
  );
  const addressBookRevision = useAddressBookStore((state) => state.revision);
  const markAddressesChanged = useAddressBookStore(
    (state) => state.markChanged,
  );
  const pkg = useOrderBuilderStore((state) => state.package);
  const isKg = pkg?.packageType === 'ORDER_BY_KG';
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
  const [addressesExpanded, setAddressesExpanded] = useState(false);
  const [checkoutEditing, setCheckoutEditing] = useState(true);
  const [scheduleChooserOpen, setScheduleChooserOpen] = useState(false);

  useEffect(() => {
    if (!checkoutCompact || !checkoutFieldError) return;
    setCheckoutEditing(true);
    if (checkoutFieldError.field === 'address') setAddressesExpanded(true);
  }, [checkoutCompact, checkoutFieldError?.field]);
  const [venueStatus, setVenueStatus] =
    useState<VenueServiceability>('checking');
  const [guestInput, setGuestInput] = useState(String(guestCount));
  const hydrated = useRef(false);
  const onSavedRef = useRef(onSaved);
  const onMissingCartRef = useRef(onMissingCart);
  const lastSavedKey = useRef('');

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    onMissingCartRef.current = onMissingCart;
  }, [onMissingCart]);

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
      .then(async ([rows, cart]) => {
        if (!current) return;
        let availableAddresses = rows;
        let forwardedAddressId = deliveryLocation?.savedAddressId ?? '';
        if (
          !forwardedAddressId &&
          deliveryLocation?.source === 'manual' &&
          deliveryLocation.address
        ) {
          const parsedAddress = createAddressSchema.safeParse({
            addressType: 'EVENT_VENUE',
            label: deliveryLocation.label || 'Event venue',
            addressLine1: deliveryLocation.address.addressLine1,
            addressLine2: deliveryLocation.address.addressLine2,
            city: deliveryLocation.address.city,
            state: deliveryLocation.address.state,
            pincode: deliveryLocation.address.pincode,
            landmark: deliveryLocation.address.landmark,
            latitude: deliveryLocation.latitude,
            longitude: deliveryLocation.longitude,
            isDefault: false,
          });
          if (parsedAddress.success) {
            let forwardedAddress = matchingSavedAddress(rows, deliveryLocation);
            if (!forwardedAddress) {
              forwardedAddress = await apiRequest<UserAddress>(
                '/me/addresses',
                {
                  method: 'POST',
                  body: JSON.stringify(parsedAddress.data),
                },
                session.accessToken,
              );
              availableAddresses = [...rows, forwardedAddress];
              markAddressesChanged();
            }
            forwardedAddressId = forwardedAddress.id;
            setDeliveryLocation({
              latitude: forwardedAddress.latitude ?? deliveryLocation.latitude,
              longitude:
                forwardedAddress.longitude ?? deliveryLocation.longitude,
              label:
                forwardedAddress.label ||
                forwardedAddress.addressLine2 ||
                forwardedAddress.addressLine1,
              source: 'saved',
              savedAddressId: forwardedAddress.id,
              address: {
                addressLine1: forwardedAddress.addressLine1,
                addressLine2: forwardedAddress.addressLine2 ?? undefined,
                city: forwardedAddress.city,
                state: forwardedAddress.state,
                pincode: forwardedAddress.pincode,
                landmark: forwardedAddress.landmark ?? undefined,
              },
              resolution: deliveryLocation.resolution,
            });
          }
        }
        if (!current) return;
        setAddresses(availableAddresses);
        const savedAddressId =
          cart?.event?.address?.id ?? cart?.address?.id ?? '';
        const nextAddressId =
          selectedAddress ||
          forwardedAddressId ||
          savedAddressId ||
          (!deliveryLocation
            ? availableAddresses.find((row) => row.isDefault)?.id ||
              availableAddresses[0]?.id
            : '') ||
          '';
        setAddressId(nextAddressId);
        if (cart?.packageVersionId === packageVersionId && cart.event) {
          setEventDate(cart.event.eventDate);
          setEventTimeStart(cart.event.eventTimeStart || '');
          setGuestCount(cart.event.guestCount ?? minPax);
          setAssignedRegion(cart.event.region ?? cart.region ?? null);
          setCheckoutEditing(
            !(
              savedAddressId &&
              cart.event.eventDate &&
              cart.event.eventTimeStart &&
              (cart.event.region ?? cart.region)
            ),
          );
          setScheduleChooserOpen(false);
        } else {
          setEventDate('');
          setEventTimeStart('');
          setCheckoutEditing(true);
          setScheduleChooserOpen(false);
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
        if (!current) return;
        if (isClearedCartError(reason)) {
          onMissingCartRef.current?.();
          return;
        }
        setMessage(reason.message);
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
    if (!checkoutCompact || !session) return;
    if (!addressId) {
      setVenueStatus('missing');
      onVenueStatusChange?.('missing');
      return;
    }
    const address = addresses.find((row) => row.id === addressId);
    if (!address) {
      setVenueStatus('missing');
      onVenueStatusChange?.('missing');
      return;
    }
    if (!address.latitude || !address.longitude) {
      setVenueStatus('missing-pin');
      onVenueStatusChange?.('missing-pin');
      return;
    }
    let current = true;
    setVenueStatus('checking');
    onVenueStatusChange?.('checking');
    void apiRequest<LocationResolution>('/operating-regions/resolve', {
      method: 'POST',
      body: JSON.stringify({
        latitude: address.latitude,
        longitude: address.longitude,
      }),
    })
      .then((resolution) => {
        if (!current) return;
        const next: VenueServiceability = resolution.serviceable
          ? 'serviceable'
          : resolution.reason === 'KITCHEN_CLOSED'
            ? 'closed'
            : 'outside';
        setVenueStatus(next);
        onVenueStatusChange?.(next);
      })
      .catch(() => {
        if (!current) return;
        setVenueStatus('error');
        onVenueStatusChange?.('error');
      });
    return () => {
      current = false;
    };
  }, [addressId, addresses, checkoutCompact, onVenueStatusChange, session]);

  useEffect(() => {
    if (!session || !hydrated.current) return;
    if (checkoutCompact && venueStatus !== 'serviceable') return;
    const validGuests =
      isKg || (guestCount >= minPax && (!maxPax || guestCount <= maxPax));
    if (!addressId) {
      setMessage('Choose a delivery venue.');
      return;
    }
    const completeEvent = Boolean(eventDate && eventTimeStart && validGuests);
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
                    ...(isKg ? {} : { guestCount }),
                  }
                : {}),
            }),
          },
          session.accessToken,
        );
        const address = addresses.find((row) => row.id === addressId)!;
        setDbCartId(cart.id);
        setAssignedRegion(cart.event?.region ?? cart.region ?? null);
        lastSavedKey.current = saveKey;
        if (completeEvent && address) setCheckoutEditing(false);
        onSavedRef.current?.(cart);
        setMessage(
          completeEvent
            ? 'Saved to your cart.'
            : 'Address saved. Add the delivery date and time to continue.',
        );
      } catch (reason) {
        if (isClearedCartError(reason)) {
          onMissingCartRef.current?.();
          return;
        }
        setMessage((reason as Error).message);
      } finally {
        setSaving(false);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    session,
    checkoutCompact,
    venueStatus,
    packageVersionId,
    cartId,
    addressId,
    eventDate,
    eventTimeStart,
    guestCount,
    minPax,
    maxPax,
    isKg,
    addresses,
    pkg?.packageName,
    setDbCartId,
  ]);

  if (!session) {
    return (
      <section className="surface-card p-5">
        <p className="font-sans text-xl font-semibold">Sign in to continue</p>
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

  const showCheckoutStatus =
    saving ||
    message === 'Saved to your cart.' ||
    Boolean(
      message &&
      !message.startsWith('Complete all required fields') &&
      !message.startsWith('Address saved. Add the delivery date') &&
      !message.startsWith('Changes pending'),
    );
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
  const minimumDeliveryInstant =
    Date.now() + (publicSettings?.minBookingLeadHours ?? 48) * 60 * 60 * 1000;
  const isTimeAvailable = (slot: DeliveryTimeSlot) =>
    !eventDate ||
    new Date(`${eventDate}T${slot.value}:00.000+05:30`).getTime() >=
      minimumDeliveryInstant;

  useEffect(() => {
    if (
      eventTimeStart &&
      !deliveryTimeSlots.some(
        (slot) => slot.value === eventTimeStart && isTimeAvailable(slot),
      )
    ) {
      setEventTimeStart('');
    }
  }, [deliveryTimeSlots, eventDate, eventTimeStart, minimumDeliveryInstant]);
  const selectedVenue = addresses.find((address) => address.id === addressId);
  const selectedLatitude = Number(selectedVenue?.latitude);
  const selectedLongitude = Number(selectedVenue?.longitude);
  const selectedVenueHasCoordinates = Boolean(
    selectedVenue?.latitude &&
    selectedVenue?.longitude &&
    Number.isFinite(selectedLatitude) &&
    selectedLatitude >= -90 &&
    selectedLatitude <= 90 &&
    Number.isFinite(selectedLongitude) &&
    selectedLongitude >= -180 &&
    selectedLongitude <= 180,
  );

  useEffect(() => {
    if (!checkoutCompact) return;
    onCheckoutStateChange?.({
      hasAddress: Boolean(selectedVenue),
      hasCoordinates: selectedVenueHasCoordinates,
      hasDate: Boolean(eventDate),
      hasTime: Boolean(eventTimeStart),
      saving,
    });
  }, [
    checkoutCompact,
    eventDate,
    eventTimeStart,
    onCheckoutStateChange,
    saving,
    selectedVenue,
    selectedVenueHasCoordinates,
  ]);

  const checkoutDetailsComplete = Boolean(
    selectedVenue && eventDate && eventTimeStart && assignedRegion,
  );
  const kitchenName = assignedRegion
    ? `${assignedRegion.name} Kitchen`
    : 'Kitchen will be assigned from delivery venue';
  const kitchenAddress =
    assignedRegion?.kitchenAddress ??
    'The preparation kitchen address will appear after the venue is saved.';
  const guestLabel = pkg?.packageType === 'MEAL_BOX' ? 'Boxes' : 'Guests';
  const earliestSuggestion = (() => {
    const leadHours = publicSettings?.minBookingLeadHours ?? 48;
    const earliestInstant = Date.now() + leadHours * 60 * 60 * 1000;
    const firstDate = localDateValue(new Date(earliestInstant));
    for (let dayOffset = 0; dayOffset < 31; dayOffset += 1) {
      const date = new Date(`${firstDate}T12:00:00`);
      date.setDate(date.getDate() + dayOffset);
      const dateValue = localDateValue(date);
      const slot = deliveryTimeSlots.find(
        (candidate) =>
          new Date(`${dateValue}T${candidate.value}:00+05:30`).getTime() >=
          earliestInstant,
      );
      if (slot) return { date: dateValue, time: slot.value };
    }
    return undefined;
  })();
  const formattedEventSlot = (date: string, time: string) =>
    new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(`${date}T${time}:00+05:30`));
  const fields = (
    <>
      {(!checkoutCompact || checkoutEditing || !checkoutDetailsComplete) && (
        <div
          className={cn(
            'grid gap-3',
            checkoutCompact
              ? 'mt-4 max-w-2xl grid-cols-2 gap-3 max-[340px]:grid-cols-1'
              : 'mt-5 gap-4 rounded-2xl border border-border bg-[#fcfaf6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
            !checkoutCompact && sidebar
              ? 'grid-cols-1'
              : !checkoutCompact && (hideQuantity || isKg)
                ? 'md:grid-cols-2'
                : !checkoutCompact
                  ? 'md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_224px]'
                  : '',
          )}
        >
          <Field
            label="Delivery date"
            className={
              checkoutCompact ? '[&>span:first-child]:sr-only' : undefined
            }
          >
            <ThemedDatePicker
              min={firstEventDate}
              value={eventDate}
              onChange={setEventDate}
              compact={checkoutCompact}
              invalid={checkoutCompact && checkoutFieldError?.field === 'date'}
            />
            {checkoutCompact && checkoutFieldError?.field === 'date' && (
              <span
                id="cart-delivery-date-error"
                role="alert"
                className="mt-1.5 block text-xs font-semibold leading-4 text-red-700"
              >
                {checkoutFieldError.message}
              </span>
            )}
          </Field>
          <Field
            label="Delivery time"
            className={
              checkoutCompact ? '[&>span:first-child]:sr-only' : undefined
            }
          >
            <ThemedTimePicker
              value={eventTimeStart}
              onChange={setEventTimeStart}
              slots={deliveryTimeSlots}
              isSlotAvailable={isTimeAvailable}
              compact={checkoutCompact}
              invalid={checkoutCompact && checkoutFieldError?.field === 'time'}
            />
            {checkoutCompact && checkoutFieldError?.field === 'time' && (
              <span
                id="cart-delivery-time-error"
                role="alert"
                className="mt-1.5 block text-xs font-semibold leading-4 text-red-700"
              >
                {checkoutFieldError.message}
              </span>
            )}
          </Field>
          {checkoutCompact && !eventTimeStart && earliestSuggestion && (
            <p className="col-span-full -mt-1 text-xs leading-5 text-muted-foreground">
              Earliest available:{' '}
              {formattedEventSlot(
                earliestSuggestion.date,
                earliestSuggestion.time,
              )}
            </p>
          )}
          {!hideQuantity && !isKg && (
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
                    className="w-16 bg-transparent text-center font-sans text-xl font-semibold outline-none"
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
      )}

      {!checkoutCompact && deliveryService}

      {!checkoutCompact && (
        <>
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
            <button
              type="button"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={onAddAddress}
            >
              <Plus className="h-4 w-4" />
              {deliveryLocation && !deliveryLocation.savedAddressId
                ? 'Complete address'
                : 'Add new address'}
            </button>
          </div>

          {deliveryLocation && !deliveryLocation.savedAddressId && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">{deliveryLocation.label}</p>
              <p className="mt-1 text-xs leading-5">
                Your map location is ready. Add the house, building or venue
                details before checkout so the kitchen receives an exact
                delivery address.
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
                          <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                            Default
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {address.addressLine1}
                        {address.addressLine2
                          ? `, ${address.addressLine2}`
                          : ''}
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
            <button
              type="button"
              onClick={onAddAddress}
              className="mt-3 flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-[#fcfaf6] p-5 text-center text-sm font-semibold text-primary transition hover:border-primary/40"
            >
              <MapPinned className="h-5 w-5" />
              <span>No delivery address added</span>
              <span className="text-xs font-medium text-muted-foreground">
                Add a venue where the food should be delivered.
              </span>
            </button>
          )}

          <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-4 text-muted-foreground">
            <p className="text-xs font-bold">Kitchen location</p>
            <p className="mt-2 text-sm font-bold text-foreground/60">
              {kitchenName}
            </p>
            <p className="mt-1 text-xs leading-5">{kitchenAddress}</p>
          </div>

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
      )}

      {checkoutCompact && (
        <>
          {!checkoutEditing && eventDate && eventTimeStart && (
            <div className="mt-4 flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-ivory/60 p-3 sm:p-4">
              <CalendarClock
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-4 text-muted-foreground">
                  Delivery date &amp; time
                </p>
                <p className="truncate text-sm font-semibold leading-5 text-foreground">
                  {formattedEventSlot(eventDate, eventTimeStart)}
                </p>
              </div>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={scheduleChooserOpen}
                onClick={() => setScheduleChooserOpen(true)}
                className="inline-flex min-h-10 shrink-0 items-center px-1 text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Change
              </button>
            </div>
          )}
          <ScheduleChooser
            open={scheduleChooserOpen}
            date={eventDate}
            time={eventTimeStart}
            minDate={firstEventDate}
            slots={deliveryTimeSlots}
            isSlotAvailable={isTimeAvailable}
            saving={saving}
            onDateChange={setEventDate}
            onTimeChange={setEventTimeStart}
            onClose={() => setScheduleChooserOpen(false)}
          />
          <div
            className={cn(
              'rounded-xl border border-border/60 bg-ivory/60 p-3 transition-[border-color,box-shadow,background-color] sm:p-4',
              !checkoutEditing && eventDate && eventTimeStart ? 'mt-3' : 'mt-4',
              checkoutFieldError?.field === 'address' &&
                'border-red-500 bg-red-50/70 ring-2 ring-red-200 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <MapPin
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                {selectedVenue ? (
                  <>
                    <p className="truncate text-sm font-semibold leading-5 text-foreground">
                      {selectedVenue.label || selectedVenue.addressLine1}
                    </p>
                    <p className="truncate text-xs leading-4 text-muted-foreground">
                      {[
                        selectedVenue.addressLine1,
                        selectedVenue.addressLine2,
                        selectedVenue.city,
                        selectedVenue.state,
                        selectedVenue.pincode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="truncate text-sm font-semibold leading-5 text-foreground">
                      {deliveryLocation?.label || 'Choose a delivery address'}
                    </p>
                    <p className="truncate text-xs leading-4 text-muted-foreground">
                      {checkoutDetailsComplete
                        ? formattedEventSlot(eventDate, eventTimeStart)
                        : 'Delivery date and time need confirmation'}
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                aria-expanded={addressesExpanded}
                aria-haspopup="dialog"
                aria-invalid={
                  checkoutFieldError?.field === 'address' || undefined
                }
                aria-describedby={
                  checkoutFieldError?.field === 'address'
                    ? 'cart-delivery-address-error'
                    : undefined
                }
                onClick={() => {
                  if (addresses.length > 0) setAddressesExpanded(true);
                  else onAddAddress?.();
                }}
                className="inline-flex min-h-10 shrink-0 items-center px-1 text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {selectedVenue ? 'Change' : 'Choose address'}
              </button>
            </div>
            {checkoutFieldError?.field === 'address' && (
              <p
                id="cart-delivery-address-error"
                role="alert"
                className="mt-2 text-xs font-semibold leading-5 text-red-700"
              >
                {checkoutFieldError.message}
              </p>
            )}
            {!selectedVenue && addresses.length === 0 && (
              <button
                type="button"
                onClick={onAddAddress}
                className="ml-6 inline-flex min-h-9 items-center text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Add complete address
              </button>
            )}
          </div>
          <AddressChooser
            open={addressesExpanded && addresses.length > 0}
            addresses={addresses}
            selectedAddressId={addressId}
            onClose={() => setAddressesExpanded(false)}
            onSelect={(nextAddressId) => {
              setVenueStatus('checking');
              onVenueStatusChange?.('checking');
              setAddressId(nextAddressId);
              setAddressesExpanded(false);
            }}
            onAddAddress={onAddAddress}
          />
          {deliveryService}
          {showCheckoutStatus && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              {saving ? 'Saving delivery details…' : message}
            </p>
          )}
        </>
      )}
    </>
  );

  return (
    <section
      id={checkoutCompact ? 'checkout-delivery' : undefined}
      className={cn(
        checkoutCompact
          ? 'rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-6'
          : 'rounded-2xl border border-border bg-white shadow-[0_14px_36px_-30px_rgba(75,12,23,.55)]',
        !checkoutCompact && (sidebar ? 'p-4' : 'p-5 sm:p-6'),
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
        {!checkoutCompact && (
          <MapPin className="h-5 w-5 shrink-0 text-primary" />
        )}
        <span className="min-w-0 flex-1">
          <span
            id="event-context-title"
            className={cn(
              'block font-sans font-semibold',
              checkoutCompact ? 'text-base' : sidebar ? 'text-xl' : 'text-2xl',
            )}
          >
            {checkoutCompact ? 'When & where' : 'Delivery details'}
          </span>
          {!checkoutCompact && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Choose when and where we should deliver.
            </span>
          )}
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
