'use client';

import {
  Award,
  Box,
  Calendar,
  ChefHat,
  Clock,
  Heart,
  Leaf,
  MapPin,
  Package,
  PartyPopper,
  ShieldCheck,
  Smile,
  Star,
  Target,
  Truck,
  UtensilsCrossed,
  Users,
} from 'lucide-react';

/* ─── Stats ─── */
const STATS = [
  { Icon: Users,      value: '10,000+', label: 'Happy Customers',      sub: 'Served across all occasions' },
  { Icon: Box,        value: '50,000+', label: 'Orders Delivered',      sub: 'With love and care' },
  { Icon: Award,      value: '10+',     label: 'Years of Experience',   sub: 'In bulk food service' },
  { Icon: MapPin,     value: '50+',     label: 'Cities Served',         sub: 'And growing' },
  { Icon: ShieldCheck,value: '100%',    label: 'Hygiene Assured',       sub: 'Safety is our priority' },
];

/* ─── Values ─── */
const VALUES = [
  { Icon: Leaf,       label: 'Fresh Ingredients', sub: 'Sourced daily' },
  { Icon: ChefHat,    label: 'Hygienic Kitchens', sub: 'Clean. Safe. Certified.' },
  { Icon: Truck,      label: 'On-time Delivery',  sub: 'Always on schedule' },
  { Icon: Heart,      label: 'Made with Care',    sub: 'By passionate chefs' },
];

/* ─── What We Offer ─── */
const OFFERINGS = [
  { Icon: Users,       label: 'Bulk Food Orders',                      sub: 'for Groups of Any Size' },
  { Icon: PartyPopper, label: 'Birthday & House Party',                 sub: 'Food Solutions' },
  { Icon: Package,     label: 'Party Packs &\nFamily Combos',           sub: '' },
  { Icon: UtensilsCrossed, label: 'Customizable Menus',                sub: '' },
  { Icon: ChefHat,     label: 'Corporate Lunch &\nDinner Orders',       sub: '' },
  { Icon: Calendar,    label: 'Scheduled Deliveries',                   sub: '' },
  { Icon: Star,        label: 'Festival & Celebration\nFood Orders',    sub: '' },
  { Icon: ShieldCheck, label: 'Hygienically Prepared &\nProfessionally Packed Meals', sub: '' },
];

/* ─── Why Choose Us ─── */
const WHY_US = [
  {
    Icon: Award,
    title: '10+ Years of\nFood Expertise',
    desc: 'Our team brings over a decade of experience in food preparation, menu planning, and serving thousands of customers.',
  },
  {
    Icon: Users,
    title: 'Built for\nBulk Orders',
    desc: 'Whether you\'re feeding 20 people or 500, our platform is designed specifically to handle large food orders efficiently.',
  },
  {
    Icon: ChefHat,
    title: 'Consistent\nQuality',
    desc: 'Every dish is prepared using standardized processes to ensure great taste and consistency every time.',
  },
  {
    Icon: Star,
    title: 'Transparent\nPricing',
    desc: 'Know exactly what you\'re paying for with clear pricing and flexible menu options.',
  },
  {
    Icon: Truck,
    title: 'Reliable\nDelivery',
    desc: 'From preparation to packaging and delivery, we ensure your order reaches you fresh and on time.',
  },
];

/* ═══════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════ */
export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">

      {/* ① Hero — About Us */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">

            {/* Left: text */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
                About Us
              </p>
              <h1 className="font-serif text-4xl font-bold leading-tight text-foreground lg:text-5xl">
                Making Bulk Food<br />Ordering Simple
              </h1>
              <div className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground">
                <p>
                  At The Feast Factory, we believe ordering food for a group should be as easy as
                  ordering a single meal. Whether you're planning a family gathering, office lunch,
                  birthday celebration, housewarming, festive occasion, or any event that brings
                  people together, we help you order delicious food in bulk without the usual hassle.
                </p>
                <p>
                  Backed by 10+ years of experience in food preparation and hospitality, The Feast
                  Factory combines culinary expertise with technology to deliver a seamless bulk food
                  ordering experience. Our focus is on quality, consistency, hygiene, and customer
                  satisfaction in every order we serve.
                </p>
              </div>

              {/* Values */}
              <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
                {VALUES.map(({ Icon, label, sub }) => (
                  <div key={label} className="text-center">
                    <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-foreground">{label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: image + experience badge */}
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80"
                alt="The Feast Factory kitchen team"
                className="h-72 w-full rounded-2xl object-cover shadow-lg sm:h-80 lg:h-[420px]"
              />
              {/* Experience overlay */}
              <div className="mt-4 flex items-center gap-3 overflow-hidden rounded-2xl bg-white shadow-xl sm:absolute sm:bottom-5 sm:right-5 sm:mt-0 sm:gap-4">
                <div className="bg-primary px-4 py-4 text-center text-white sm:px-5">
                  <p className="text-3xl font-extrabold leading-none">10+</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest">Years of</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest">Experience</p>
                </div>
                <div className="min-w-0 py-4 pr-4 sm:pr-5">
                  <p className="max-w-[130px] text-sm font-semibold leading-5 text-foreground">
                    Trusted by thousands of customers and organizations across the city.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ② Stats bar */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid divide-y divide-border lg:divide-x lg:divide-y-0 lg:grid-cols-5">
            {STATS.map(({ Icon, value, label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-2 py-7 text-center">
                <Icon className="h-6 w-6 text-primary/70" />
                <p className="text-2xl font-extrabold text-foreground">{value}</p>
                <div>
                  <p className="text-sm font-bold text-foreground">{label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ③ Mission + What We Offer */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

          {/* Mission card */}
          <div className="flex flex-col items-center rounded-2xl bg-primary px-8 py-10 text-center text-white">
            <p className="font-serif text-2xl font-bold text-accent">Our Mission</p>
            <div className="my-5 grid h-16 w-16 place-items-center rounded-full border-2 border-white/20">
              <Target className="h-8 w-8 text-white/80" />
            </div>
            <p className="text-sm leading-7 text-white/85">
              To make bulk food ordering convenient, affordable, and dependable for every
              celebration, gathering, and business need.
            </p>
          </div>

          {/* What We Offer */}
          <div className="rounded-2xl border border-border bg-white p-8">
            <h2 className="mb-1 font-serif text-2xl font-bold text-foreground">What We Offer</h2>
            <div className="mt-1 mb-6 h-0.5 w-10 rounded-full bg-primary" />
            <div className="grid gap-5 lg:grid-cols-2">
              {OFFERINGS.map(({ Icon, label, sub }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground whitespace-pre-line">{label}</p>
                    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ④ Why Choose Us */}
      <section className="border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center font-serif text-3xl font-bold text-foreground">
            Why Choose The Feast Factory?
          </h2>
          <div className="grid gap-6 lg:grid-cols-5">
            {WHY_US.map(({ Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <p className="mb-2 text-sm font-bold text-foreground whitespace-pre-line">{title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑤ Vision + Food Image + Gathering */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3 lg:items-center">

          {/* Vision */}
          <div className="rounded-2xl border border-border bg-white p-8">
            <p className="font-serif text-2xl font-bold text-primary">Our Vision</p>
            <div className="mt-1 mb-5 h-0.5 w-10 rounded-full bg-accent" />
            <p className="text-sm leading-7 text-muted-foreground">
              To become India's most trusted bulk food ordering platform, enabling people and
              organizations to enjoy great food without the complexities of planning and
              coordination.
            </p>
            {/* City skyline placeholder */}
            <div className="mt-8 flex items-end gap-1 opacity-20">
              {[24, 32, 20, 40, 28, 36, 22, 30, 18, 26, 34].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-primary" style={{ height: h }} />
              ))}
            </div>
          </div>

          {/* Center image */}
          <div className="overflow-hidden rounded-2xl shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=700&q=80"
              alt="Variety of Indian dishes"
              className="h-72 w-full object-cover lg:h-80"
            />
          </div>

          {/* Food for Every Gathering */}
          <div className="rounded-2xl border border-border bg-white p-8">
            <p className="font-serif text-2xl font-bold text-primary">
              Food for Every Gathering
            </p>
            <div className="mt-1 mb-5 h-0.5 w-10 rounded-full bg-accent" />
            <p className="text-sm leading-7 text-muted-foreground">
              From office meetings and team lunches to birthdays, family functions, festive
              celebrations, and community events, The Feast Factory makes bulk food ordering
              simple, reliable, and stress-free.
            </p>
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-xs font-semibold text-foreground">
                Powered by 10+ Years of Food Preparation Excellence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ⑥ Footer band */}
      <div className="bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-white/30">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-white">The Feast Factory</p>
                <p className="text-[11px] text-white/60">Order More. Stress Less. Celebrate Better. 🎉</p>
              </div>
            </div>

            {/* Pillars */}
            <div className="grid w-full grid-cols-2 gap-4 sm:w-auto sm:grid-cols-4 sm:gap-6 lg:gap-8">
              {[
                { Icon: UtensilsCrossed, label: 'Great Food' },
                { Icon: Smile,          label: 'Happy People' },
                { Icon: Heart,          label: 'Memorable Moments' },
                { Icon: Clock,          label: 'Every Time' },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex min-w-0 flex-col items-center gap-1 text-center">
                  <Icon className="h-5 w-5 text-white/70" />
                  <span className="text-[10px] font-semibold text-white/70">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
