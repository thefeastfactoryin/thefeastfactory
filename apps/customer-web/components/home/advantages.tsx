import {
  Clock3,
  HeartPulse,
  Leaf,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

const advantages: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Fresh ingredients',
    description: 'Sourced daily for the best taste',
    icon: Leaf,
  },
  {
    title: 'Hygienic packaging',
    description: 'Food-safe and tamper-evident',
    icon: ShieldCheck,
  },
  {
    title: 'Balanced nutrition',
    description: 'Curated for a wholesome meal',
    icon: HeartPulse,
  },
  {
    title: 'Timely delivery',
    description: 'Planned around your serving time',
    icon: Clock3,
  },
];

export function Advantages() {
  return (
    <section className="border-y border-border bg-ivory-warm">
      <div className="container-pad py-7 sm:py-14">
        <div className="mb-5 max-w-xl sm:mb-8">
          <p className="eyebrow text-gold-text">The Feast Factory promise</p>
          <h2 className="mt-2 font-serif text-[24px] font-bold leading-[1.15] text-foreground sm:text-3xl sm:leading-tight">
            Thoughtful food, from our kitchen to your gathering.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="group min-h-[122px] bg-white p-4 sm:min-h-0 sm:p-6"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white sm:h-11 sm:w-11 sm:rounded-xl">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-serif text-sm font-bold leading-tight sm:mt-5 sm:text-lg">
                {title}
              </h3>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground sm:text-sm sm:leading-6">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
