import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChefHat,
  CheckCircle2,
  Clock,
  CreditCard,
  Home,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';

const ORDER_TYPES = [
  {
    Icon: Package,
    title: 'Meal Boxes',
    desc: 'Individually packed meals for offices, trainings, and community events.',
    cta: 'Explore meal boxes',
    href: '/packages/meal-boxes',
    img: '/order-mealbox.png',
  },
  {
    Icon: CalendarDays,
    title: 'Occasion Packages',
    desc: 'Curated menus for birthdays, pujas, house parties, and gatherings.',
    cta: 'View packages',
    href: '/packages',
    img: '/order-occasion.png',
  },
  {
    Icon: ChefHat,
    title: 'Build Your Own Menu',
    desc: 'Choose dishes, set guest count, and review pricing before checkout.',
    cta: 'Browse menu',
    href: '/menu',
    img: '/order-build.png',
  },
];

const PACKAGES = [
  {
    tag: 'Most Popular',
    Icon: Home,
    title: 'Farm House Celebration',
    serves: 'Serves 20-200 people',
    price: 'Rs. 599',
    href: '/packages',
    img: '/pkg-farmhouse.png',
  },
  {
    tag: null,
    Icon: Sparkles,
    title: 'Puja Package',
    serves: 'Serves 20-500 people',
    price: 'Rs. 499',
    href: '/packages',
    img: '/pkg-puja.png',
  },
  {
    tag: null,
    Icon: Users,
    title: 'Community Gathering',
    serves: 'Serves 50-1,000 people',
    price: 'Rs. 449',
    href: '/packages',
    img: '/pkg-community.png',
  },
  {
    tag: null,
    Icon: Briefcase,
    title: 'Corporate Party',
    serves: 'Serves 20-1,000 people',
    price: 'Rs. 649',
    href: '/packages',
    img: '/pkg-corporate.png',
  },
];

const HERO_TRUST = [
  { Icon: ShieldCheck, label: 'Hygienic preparation' },
  { Icon: Truck, label: 'On-time delivery' },
  { Icon: CreditCard, label: 'Transparent pricing' },
];

const TRUST_ITEMS = [
  {
    Icon: Users,
    title: 'Orders from 20 guests',
    desc: 'Built for family and community gatherings.',
  },
  {
    Icon: Clock,
    title: '48-hour lead time',
    desc: 'Enough time to plan, prepare, and dispatch well.',
  },
  {
    Icon: ShieldCheck,
    title: 'Food-safe handling',
    desc: 'Prepared, packed, and handed over with care.',
  },
  {
    Icon: MessageCircle,
    title: 'Dedicated support',
    desc: 'Help with package choice, event details, and checkout.',
  },
];

export default function HomePage() {
  return (
    <main className="bg-background">
      <section
        className="overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 28% 35%, hsl(41 56% 44% / 0.10), transparent 34%), radial-gradient(circle at 50% 50%, transparent 56%, rgba(28, 0, 8, 0.22) 100%), linear-gradient(135deg, hsl(352 62% 16%), hsl(352 62% 13%))',
        }}
      >
        <div className="container-pad">
          <div className="grid items-center gap-6 py-8 sm:gap-8 sm:py-10 lg:min-h-[448px] lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:py-12">
            <div className="max-w-xl">
              <p className="eyebrow text-accent">Premium bulk catering</p>
              <h1 className="mt-4 font-serif text-4xl font-bold leading-[0.98] tracking-tight text-white sm:text-[42px] lg:text-[3.75rem]">
                Premium food for every{' '}
                <span className="italic text-accent">occasion</span>.
              </h1>
              <p className="mt-4 max-w-[460px] text-[15px] leading-7 text-white/75">
                Premium catering for birthdays, weddings, office events and
                celebrations. Freshly prepared, beautifully presented and
                delivered on time.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/packages"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-primary shadow-[0_9px_22px_rgba(0,0,0,0.16)] transition-all duration-250 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_13px_28px_rgba(0,0,0,0.18)]"
                >
                  View packages <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/menu"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-accent/30 bg-primary/15 px-6 text-sm font-bold text-white transition-all duration-250 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Browse menu
                </Link>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {HERO_TRUST.map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[13px] font-bold text-white/90">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-accent">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative lg:-mr-16">
              <div className="absolute -bottom-3 -right-3 hidden h-full w-full rounded-[24px] border border-accent/15 lg:block" />
              <div className="relative overflow-hidden rounded-[24px] border border-accent/15 shadow-[0_22px_52px_rgba(0,0,0,0.30)]">
                <img
                  src="/Hero.png"
                  alt="Catering trays prepared for a celebration"
                  className="aspect-[16/9] w-full scale-[1.03] object-cover transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:scale-[1.045] lg:aspect-[1.7/1] lg:scale-[1.18] lg:hover:scale-[1.2]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-pad py-10 lg:py-12">
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <p className="eyebrow">How You Order</p>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-foreground sm:text-[1.7rem]">
            Choose the ordering style that fits your event
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {ORDER_TYPES.map(({ Icon, title, desc, cta, href, img }) => (
            <Link
              key={title}
              href={href}
              className="group grid min-h-[188px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_2px_14px_rgba(0,0,0,0.045)] transition-all duration-250 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_14px_34px_rgba(0,0,0,0.08)] lg:grid-cols-[1fr_34%]"
            >
              <div className="flex flex-col justify-between p-5">
                <div>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-4 font-serif text-lg font-bold leading-tight text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
                    {desc}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary">
                  {cta} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="relative min-h-44 overflow-hidden lg:min-h-full">
                <img
                  src={img}
                  alt={title}
                  className="h-full w-full object-cover transition duration-500 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.05]"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-pad pb-12 lg:pb-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Curated For Every Event</p>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-foreground">
              Popular occasion packages
            </h2>
          </div>
          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary"
          >
            View all packages <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {PACKAGES.map(({ tag, Icon, title, serves, price, href, img }) => (
            <Link
              key={title}
              href={href}
              className="group overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_2px_14px_rgba(0,0,0,0.045)] transition-all duration-250 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_14px_34px_rgba(0,0,0,0.08)]"
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={img}
                  alt={title}
                  className="h-full w-full object-cover transition duration-500 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                {tag && (
                  <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                    {tag}
                  </span>
                )}
                <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h3 className="font-serif text-lg font-bold leading-tight text-white">
                    {title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-white/70">{serves}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Starts at
                  </p>
                  <p className="mt-0.5 text-[1.35rem] font-extrabold tracking-tight text-primary">
                    {price}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">
                      / person
                    </span>
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-pad pb-14 lg:pb-20">
        <div className="grid overflow-hidden rounded-xl border border-border/80 bg-[hsl(39_50%_98%)] shadow-[0_2px_14px_rgba(0,0,0,0.04)] lg:grid-cols-4">
          {TRUST_ITEMS.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 border-border p-4 lg:p-5"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="container-pad grid gap-8 py-10 lg:grid-cols-[0.9fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow">Why families trust us</p>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground">
              Clear ordering, dependable food, and no surprise pricing.
            </h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {[
              'Menus show what is included before you proceed.',
              'Guest count and delivery details stay visible during checkout.',
              'Secure payment is handled through Razorpay.',
              'Support is available for event and order questions.',
            ].map((item) => (
              <div key={item} className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
