'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

const controlClass =
  'min-h-11 w-full rounded-xl border bg-white px-3.5 py-2 text-sm outline-none transition hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-muted-foreground';

export function Field({
  label,
  children,
  optional,
  className,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
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
    </label>
  );
}

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, style, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      controlClass,
      'cursor-pointer appearance-none bg-no-repeat pr-10 disabled:cursor-not-allowed',
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      backgroundPosition: 'right 0.875rem center',
      ...style,
    }}
    {...props}
  />
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
