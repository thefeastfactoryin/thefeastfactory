'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

const controlClass = 'min-h-10 w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50';

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
>(({ className, ...props }, ref) => <select ref={ref} className={cn(controlClass, className)} {...props} />);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => <textarea ref={ref} rows={rows} className={cn(controlClass, 'resize-y', className)} {...props} />);
Textarea.displayName = 'Textarea';
