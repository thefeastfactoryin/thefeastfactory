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
      <div className="container-pad py-12 sm:py-14">
        <div className="mb-8 max-w-xl">
          <p className="eyebrow text-gold-text">The Feast Factory promise</p>
          <h2 className="mt-2 font-serif text-3xl font-bold leading-tight text-foreground">
            Thoughtful food, from our kitchen to your gathering.
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map(({ title, description, icon: Icon }) => (
            <article key={title} className="group bg-white p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-serif text-lg font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
