import type { ReactNode } from 'react';

/** Shared mobile order actions, positioned above the customer navigation. */
export function MobileOrderBar({
  children,
  label,
  checkout = false,
}: {
  children: ReactNode;
  label: string;
  checkout?: boolean;
}) {
  return (
    <section
      aria-label={label}
      className={
        checkout
          ? 'mobile-order-bar !bottom-0 pb-[max(.5rem,env(safe-area-inset-bottom))]'
          : 'mobile-order-bar'
      }
    >
      {children}
    </section>
  );
}
