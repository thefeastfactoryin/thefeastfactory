'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/utils';

export type AdminSectionTab<Value extends string> = {
  value: Value;
  label: string;
  count?: number;
  icon?: LucideIcon;
};

export function AdminSectionTabs<Value extends string>({
  value,
  onChange,
  tabs,
  label,
  className,
}: {
  value: Value;
  onChange: (value: Value) => void;
  tabs: Array<AdminSectionTab<Value>>;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex gap-1 overflow-x-auto border-b', className)}
      role="tablist"
      aria-label={label}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            id={`${label.toLowerCase().replaceAll(' ', '-')}-${tab.value}-tab`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${label.toLowerCase().replaceAll(' ', '-')}-${tab.value}-panel`}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex min-h-11 min-w-fit items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors',
              active
                ? 'text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px]',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
