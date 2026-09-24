import type { ReactNode } from 'react';

/** Shared mobile order actions, positioned above the customer navigation. */
export function MobileOrderBar({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section aria-label={label} className="mobile-order-bar">
      {children}
    </section>
  );
}
