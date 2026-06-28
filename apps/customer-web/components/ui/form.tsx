'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

const controlClass =
  'min-h-12 w-full rounded-xl border border-input bg-white/95 px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50';

export function Field({
  label,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
        <span>{label}</span>
        {optional && (
          <span className="text-xs font-medium text-muted-foreground">
            Optional
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(controlClass, className)} {...props} />
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(controlClass, 'resize-y', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function DateField({
  value,
  min,
  onValueChange,
  required,
}: {
  value: string;
  min?: string;
  onValueChange: (value: string) => void;
  required?: boolean;
}) {
  return <input className={controlClass} type="date" value={value} min={min} required={required} onChange={(event) => onValueChange(event.target.value)} />;
}

export function TimeField({
  value,
  onValueChange,
  required,
}: {
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
}) {
  return <input className={controlClass} type="time" value={value} required={required} onChange={(event) => onValueChange(event.target.value)} />;
}

export function Checkbox({
  label,
  description,
  checked,
  onCheckedChange,
  className,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-white/75 p-3 text-left transition hover:border-primary/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        checked && 'border-primary/50 bg-primary/[0.055]',
        className,
      )}
    >
      <input type="checkbox" checked={checked} readOnly tabIndex={-1} className="h-5 w-5 accent-primary" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

export function ChoiceCard({
  label,
  description,
  selected,
  onSelect,
  children,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-20 w-full items-start gap-3 rounded-xl border bg-white/80 p-4 text-left transition hover:border-primary/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        selected && 'border-primary bg-primary/[0.055] ring-1 ring-primary/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border bg-white',
          selected && 'border-primary',
        )}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {description && (
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        )}
        {children}
      </span>
    </button>
  );
}
