'use client';

import type { OperatingRegion } from '@aranyam/shared-types';
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ChefHat,
  HeartHandshake,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KitchenLocationsSection } from '../../components/home/kitchen-locations';
import { apiRequest } from '../../lib/api';

const stats = [
  { Icon: Calendar, value: '2015', label: 'F&B journey began' },
  { Icon: Award, value: '10+', label: 'Years of experience' },
  { Icon: MapPin, value: '4', label: 'Major cities' },
  { Icon: ChefHat, value: 'Multiple', label: 'Restaurant and banquet experience' },
  { Icon: Users, value: '500+', label: 'Guest event capability' },
];

const promises = [
  {
    Icon: Building2,
    title: 'Own kitchens',
    text: 'Prepared in our kitchens by experienced teams.',
  },
  {
    Icon: ShieldCheck,
    title: 'Quality control',
    text: 'From preparation to delivery, we maintain strict checks.',
  },
  {
    Icon: PackageCheck,
    title: 'Valid food licences',
    text: 'Our kitchens are backed by valid food business licences.',
  },
  {
    Icon: Sparkles,
    title: 'Hygiene focus',
    text: 'Clean kitchens, safe handling, and quality standards.',
  },
  {
    Icon: HeartHandshake,
    title: 'Not outsourced',
    text: 'We do not hand over orders to third-party food vendors.',
  },
  {
    Icon: Truck,
    title: 'On-time delivery',
    text: 'Timely, reliable delivery is part of our service promise.',
  },
];

const journey = [
  { title: 'Experience', text: 'Hands-on F&B experience since 2015' },
  { title: 'Learn', text: 'Understanding customer needs across events' },
  { title: 'Evolve', text: 'Building strong kitchen processes' },
  { title: 'Deliver', text: 'Putting experience into bulk food service' },
];

const credentials = [
  'FSSAI licensed kitchens',
  'GST registered and compliant',
  'Legal business operating in Telangana',
  '10+ years of food and hospitality experience',
];

export default function AboutPage() {
  const [kitchens, setKitchens] = useState<OperatingRegion[]>([]);

  useEffect(() => {
    apiRequest<OperatingRegion[]>('/operating-regions')
      .then(setKitchens)
      .catch(() => setKitchens([]));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-white">
        <div className="container-pad grid gap-10 py-10 lg:grid-cols-[0.86fr_1fr] lg:items-center lg:py-12">
          <div>
            <p className="eyebrow text-primary">About us</p>
            <h1 className="mt-3 max-w-[560px] font-serif text-[38px] font-bold leading-[1.04] text-foreground sm:text-5xl">
              A Decade of Food Experience.{' '}
              <span className="text-primary">Now Delivered in Bulk.</span>
            </h1>
            <div className="mt-5 max-w-[620px] space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                We are a food and hospitality company with a journey dating
                back to 2015. Over the years, we have built strong experience in
                restaurant operations, banquets, and large-scale food service
                across Telangana.
              </p>
              <p>
                The Feast Factory brings that experience to you through a
                simple, reliable, and transparent bulk food ordering platform.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {stats.map(({ Icon, value, label }) => (
                <div key={label} className="text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-3 font-serif text-xl font-bold text-foreground">
                    {value}
                  </p>
                  <p className="mt-1 text-[11px] font-medium leading-4 text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <Image
              src="/about-hero.png"
              alt="Guests enjoying a catered Indian gathering"
              width={1672}
              height={941}
              priority
              sizes="(max-width: 1024px) 100vw, 54vw"
              className="h-[360px] w-full rounded-2xl object-cover shadow-lg sm:h-[440px]"
            />
            <div className="absolute bottom-5 right-5 w-[min(78%,300px)] rounded-2xl bg-white p-5 shadow-xl">
              <h2 className="font-serif text-2xl font-bold leading-tight text-foreground">
                Built on Experience. Driven by Trust.
              </h2>
              <div className="mt-4 space-y-2.5 text-sm font-semibold text-muted-foreground">
                {['Own Kitchens', 'Valid Food Licences', 'Not Outsourced', 'Quality Assured'].map(
                  (item) => (
                    <p key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </p>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-pad grid gap-6 py-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="eyebrow text-primary">Our journey</p>
          <h2 className="mt-3 font-serif text-3xl font-bold leading-tight">
            From Restaurants and Banquets to Bulk Food
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Since 2015, we have been creating memorable food experiences through
            restaurants and banquet services. This journey has given us a deep
            understanding of quality, quantity, hygiene, timely delivery, and
            customer satisfaction.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {journey.map((item) => (
              <div key={item.title} className="text-center">
                <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">{item.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="eyebrow text-primary">Why customers trust us</p>
          <h2 className="mt-3 font-serif text-3xl font-bold leading-tight">
            Our Promise to You
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {promises.map(({ Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <KitchenLocationsSection
        locations={kitchens}
        className="border-y border-border bg-white py-10 lg:py-12"
      />

      <section className="container-pad grid gap-6 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="eyebrow text-primary">Our corporate office</p>
          <h2 className="mt-3 font-serif text-3xl font-bold leading-tight">
            A Business You Can Reach
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Our corporate operations are managed from our Hyderabad office,
            supporting our kitchens and customer service across Telangana.
          </p>
          <p className="mt-5 flex gap-2 text-sm font-semibold leading-6 text-foreground">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
            2nd Floor, Jains Balaji Big Town Complex, 203, Malkajgiri,
            Telangana 500047, India.
          </p>
          <Link
            href="https://www.google.com/maps?q=Jains+Balaji+Big+Town+Complex+Malkajgiri"
            target="_blank"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white"
          >
            View on Map <MapPin className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Image
            src="/office-hero.png"
            alt="The Feast Factory food service setup"
            width={1200}
            height={800}
            sizes="(max-width: 1024px) 100vw, 34vw"
            className="h-full min-h-[260px] rounded-2xl object-cover shadow-sm"
          />
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <p className="eyebrow text-primary">Our credentials</p>
            <div className="mt-5 space-y-4">
              {credentials.map((credential) => (
                <p
                  key={credential}
                  className="flex items-center gap-3 text-sm font-bold text-foreground"
                >
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {credential}
                </p>
              ))}
            </div>
            <div className="mt-7 rounded-2xl bg-primary p-5 text-white">
              <p className="font-serif text-2xl font-bold">
                From 10 guests to 2500+ guests
              </p>
              <p className="mt-2 text-sm leading-6 text-white/80">
                No matter the gathering size, we are here with delicious food
                and timely delivery to make your event a grand success.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-pad pb-12">
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-2xl font-bold text-foreground">
              Need help with your bulk order?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Our team can assist with planning your event and choosing the
              right package.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="tel:+919000000000"
              className="inline-flex min-h-11 items-center rounded-full border border-primary/30 px-5 text-sm font-bold text-primary"
            >
              Call Us
            </Link>
            <Link
              href="/packages"
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-white"
            >
              Order Now
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
