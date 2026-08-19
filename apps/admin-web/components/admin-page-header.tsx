import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  filters,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('border-b pb-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="admin-eyebrow">{eyebrow}</p>
          <h1 className="admin-title mt-2">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {filters && (
        <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
          {filters}
        </div>
      )}
    </header>
  );
}
