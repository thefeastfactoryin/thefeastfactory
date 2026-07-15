'use client';

import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

export function OrderProgress({
  current,
  context = 'Package',
  inverse = false,
}: {
  current: 0 | 1 | 2;
  context?: 'Package' | 'Meal box';
  inverse?: boolean;
}) {
  const steps = [context, 'Menu', 'Event & payment'];
  return (
    <nav aria-label="Order progress" className="flex items-center">
      {steps.map((label, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <div
            key={label}
            className="flex min-w-0 flex-1 items-center last:flex-none"
          >
            <div className="flex shrink-0 items-center gap-2.5">
              <span
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full border text-xs font-extrabold',
                  complete &&
                    (inverse
                      ? 'border-white bg-white text-primary shadow-sm'
                      : 'border-primary bg-primary text-white'),
                  active && 'border-accent bg-accent text-accent-foreground',
                  !complete &&
                    !active &&
                    (inverse
                      ? 'border-white/30 bg-white/10 text-white/70'
                      : 'border-border bg-white text-muted-foreground'),
                )}
                aria-current={active ? 'step' : undefined}
              >
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden whitespace-nowrap text-sm sm:block',
                  active
                    ? inverse
                      ? 'font-bold text-white'
                      : 'font-bold text-foreground'
                    : inverse
                      ? complete
                        ? 'font-semibold text-white/90'
                        : 'text-white/60'
                      : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                className={cn(
                  'mx-3 h-px min-w-5 flex-1 sm:mx-5',
                  index < current
                    ? inverse
                      ? 'h-0.5 bg-accent'
                      : 'bg-primary/60'
                    : inverse
                      ? 'bg-white/25'
                      : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
