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
