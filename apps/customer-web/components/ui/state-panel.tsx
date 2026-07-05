import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  LockKeyhole,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';

type StatePanelProps = {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  children?: ReactNode;
  className?: string;
  tone?: 'default' | 'danger' | 'loading';
  headingLevel?: 1 | 2;
};

export function StatePanel({
  icon: Icon,
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
  children,
  className,
  tone = 'default',
  headingLevel = 1,
}: StatePanelProps) {
  const FallbackIcon =
    tone === 'danger' ? AlertCircle : tone === 'loading' ? Loader2 : Search;
  const PanelIcon = Icon ?? FallbackIcon;
  const Heading = headingLevel === 2 ? 'h2' : 'h1';

  return (
    <div
      className={cn(
        'surface-card mx-auto max-w-xl p-8 text-center sm:p-10',
        className,
      )}
    >
      <span
        className={cn(
          'mx-auto grid h-16 w-16 place-items-center rounded-full',
          tone === 'danger'
            ? 'bg-red-50 text-red-700'
            : 'bg-primary/10 text-primary',
        )}
      >
        <PanelIcon
          className={cn('h-7 w-7', tone === 'loading' && 'animate-spin')}
        />
      </span>
      {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
      <Heading className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">
        {title}
      </Heading>
      {description && (
        <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
      )}
      {children}
      {(actionHref || secondaryHref) && (
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {actionHref && actionLabel && (
            <Button asChild>
              <Link href={actionHref}>
                {actionLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          {secondaryHref && secondaryLabel && (
            <Button asChild variant="outline">
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function AuthRequiredPanel({
  title,
  description,
  returnHref,
}: {
  title: string;
  description: string;
  returnHref?: string;
}) {
  return (
    <main className="page-shell">
      <StatePanel
        icon={LockKeyhole}
        eyebrow="Secure step"
        title={title}
        description={description}
        actionHref={
          returnHref
            ? `/login?returnTo=${encodeURIComponent(returnHref)}`
            : '/login'
        }
        actionLabel="Continue with mobile"
        secondaryHref="/packages"
        secondaryLabel="Browse packages"
      />
    </main>
  );
}
