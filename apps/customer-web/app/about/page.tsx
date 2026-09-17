'use client';

import type { OperatingRegion } from '@aranyam/shared-types';
import {
  Award,
  Building2,
  Cake,
  Calendar,
  CalendarDays,
  Church,
  Flower2,
  HeartHandshake,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  Utensils,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KitchenLocationsSection } from '../../components/home/kitchen-locations';
import { usePublicSettings } from '../../components/public-settings-provider';
import { apiRequest } from '../../lib/api';

const stats = [
  { Icon: Calendar, value: '2015', label: 'F&B journey began' },
  { Icon: Award, value: '10+', label: 'Years of experience' },
  { Icon: MapPin, value: '4', label: 'Major cities' },
  { Icon: Users, value: '2,500+', label: 'Guest capability' },
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

const team = [
  { name: 'Rakesh Reddy', role: 'Founder & CEO', image: '/RakeshReddy.png' },
  { name: 'Bhuvan', role: 'Co-Founder & COO', image: '/Bhuvan.jpeg' },
  {
    name: 'Arun Kumar',
    role: 'Co-Founder & Strategic Advisor',
    image: '/ArunKumar.jpeg',
  },
  {
    name: 'Sandeep Goud',
    role: 'Co-Founder & Business Advisor',
    image: '/Sandeep.jpeg',
  },
];

const credentialItems = [
  { Icon: CalendarDays, title: 'FSSAI Licensed', text: 'Kitchens' },
  { Icon: Award, title: 'GST Registered', text: '& Compliant' },
  { Icon: Building2, title: 'Legal Business', text: 'Operating in Telangana' },
  {
    Icon: Sparkles,
    title: '10+ Years of Experience',
    text: 'in Food & Hospitality',
  },
];

const eventTypes = [
  { Icon: Users, label: 'Weddings' },
  { Icon: Building2, label: 'Corporate Events' },
  { Icon: Cake, label: 'Birthdays' },
  { Icon: Church, label: 'Religious Events' },
  { Icon: Flower2, label: 'Community Events' },
  { Icon: Utensils, label: 'Long Term Catering' },
];

export default function AboutPage() {
  const settings = usePublicSettings();
  const [kitchens, setKitchens] = useState<OperatingRegion[]>([]);

  useEffect(() => {
    apiRequest<OperatingRegion[]>('/operating-regions')
      .then(setKitchens)
      .catch(() => setKitchens([]));
  }, []);

  return (
    <main className="about-page min-h-screen bg-background">
      <section className="border-b border-border bg-white">
        <div className="container-pad grid min-w-0 gap-5 py-6 lg:grid-cols-[0.86fr_1fr] lg:gap-x-8 lg:gap-y-0 lg:py-9">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="eyebrow text-primary">About us</p>
            <h1 className="mt-3 max-w-[560px] break-words font-serif text-[34px] font-bold leading-[1.03] text-foreground sm:text-[44px]">
              A Decade of Food Experience.{' '}
              <span className="text-primary">Now Delivered in Bulk.</span>
            </h1>
            <div className="mt-4 max-w-[620px] text-[13px] leading-[1.65] text-muted-foreground sm:mt-5 sm:leading-6">
              <p>
                Since 2015, we have built hands-on experience across
                restaurants, banquets, and large events in Telangana. The Feast
                Factory brings that experience to bulk ordering through our own
                kitchens.
              </p>
            </div>
          </div>

          <div className="relative min-w-0 overflow-hidden rounded-[14px] shadow-md lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center lg:shadow-lg">
            <Image
              src="/about-hero.png"
              alt="Guests enjoying a catered gathering by The Feast Factory"
              width={1672}
              height={941}
              priority
              sizes="(max-width: 1024px) 100vw, 54vw"
              className="h-[210px] w-full object-cover sm:h-[320px] lg:h-[380px]"
            />
            <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/75 via-black/35 to-transparent px-6 pb-5 pt-14 lg:block">
              <h2 className="font-serif text-2xl font-bold leading-tight text-white">
                Built on Experience. Driven by Trust.
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 lg:col-start-1 lg:row-start-2 lg:mt-7 lg:self-start">
            {stats.map(({ Icon, value, label }) => (
              <div key={label} className="min-w-0 text-center">
                <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                </div>
                <p className="mt-2 font-serif text-lg font-bold text-foreground sm:mt-3 sm:text-xl">
                  {value}
                </p>
                <p className="mt-0.5 text-[10px] font-medium leading-3.5 text-muted-foreground sm:mt-1 sm:text-[11px] sm:leading-4">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-pad grid gap-4 py-6 sm:gap-5 sm:py-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="about-panel">
          <p className="eyebrow text-primary">Our journey</p>
          <h2 className="mt-3 font-serif text-[26px] font-bold leading-tight sm:text-3xl">
            From Restaurants and Banquets to Bulk Food
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-muted-foreground sm:mt-4 sm:text-sm sm:leading-7">
            Our restaurant and banquet experience taught us how to manage
            quality, quantity, hygiene, and timely delivery at event scale.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:mt-6 sm:grid-cols-4">
            {journey.map((item) => (
              <div key={item.title} className="text-center">
                <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="about-panel">
          <p className="eyebrow text-primary">Why customers trust us</p>
          <h2 className="mt-3 font-serif text-[26px] font-bold leading-tight sm:text-3xl">
            Our Promise to You
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-5">
            {promises.map(({ Icon, title, text }) => (
              <div
                key={title}
                className="flex items-center gap-2.5 sm:items-start sm:gap-3"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 sm:h-10 sm:w-10">
                  <Icon
                    className="h-4.5 w-4.5 text-primary sm:h-5 sm:w-5"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-4 text-foreground sm:text-sm">
                    {title}
                  </p>
                  <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">
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
        variant="about"
        className="scroll-mt-24 border-y border-border bg-white py-7 lg:py-8"
      />

      <section className="container-pad grid items-stretch gap-4 py-6 sm:gap-5 sm:py-7 lg:grid-cols-[0.72fr_1.78fr]">
        <div className="about-panel flex flex-col justify-between lg:min-h-[330px]">
          <p className="eyebrow text-primary">Our corporate office</p>
          <h2 className="mt-2 font-serif text-2xl font-bold leading-tight">
            A Business You Can Reach
          </h2>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Our corporate operations are managed from our Hyderabad office,
            supporting our kitchens and customer service across Telangana.
          </p>
          <p className="mt-4 flex gap-2 text-xs font-semibold leading-5 text-foreground">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
            2nd Floor, Jains Balaji Big Town Complex, 203, Malkajgiri, Telangana
            500047, India.
          </p>
          <Link
            href="https://www.google.com/maps?q=Jains+Balaji+Big+Town+Complex+Malkajgiri"
            target="_blank"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white"
          >
            View on Map <MapPin className="h-4 w-4" />
          </Link>
        </div>
        <div className="about-panel lg:min-h-[330px]">
          <p className="eyebrow text-primary">Our team</p>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-5">
            {team.map((member) => (
              <div key={member.name} className="min-w-0 text-center">
                <div
                  className="about-team-photo"
                  style={{ backgroundImage: `url(${member.image})` }}
                />
                <p className="mt-3 text-sm font-bold leading-5 text-foreground">
                  {member.name}
                </p>
                <p className="mt-1 text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                  {member.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-pad pb-5">
        <div className="about-credentials-panel">
          <p className="eyebrow text-primary">Our credentials</p>
          <div className="about-credentials-grid">
            {credentialItems.map(({ Icon, title, text }) => (
              <div key={title} className="about-credential-item">
                <Icon
                  className="h-7 w-7 shrink-0 text-primary"
                  strokeWidth={1.5}
                />
                <p>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </p>
              </div>
            ))}
            <div className="about-years-badge">
              <strong>10+</strong>
              <span>YEARS</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container-pad pb-8">
        <div className="about-events-panel">
          <div className="about-capacity">
            <p className="font-serif text-lg font-bold">
              From 10 to 2,500+ guests
            </p>
            <p className="mt-1 text-[10px] leading-4 text-white/80">
              Reliable food preparation and timely delivery for gatherings of
              every size.
            </p>
          </div>
          <div className="about-event-grid">
            {eventTypes.map(({ Icon, label }) => (
              <div key={label} className="about-event-item">
                <Icon className="h-7 w-7 text-primary" strokeWidth={1.4} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-pad pb-10">
        <div className="about-help-panel">
          <div>
            <p className="font-serif text-[22px] font-bold leading-tight text-foreground sm:text-2xl">
              Need help with your bulk order?
            </p>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground sm:text-sm">
              We can help plan your event and choose the right package.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={settings?.business.supportPhone ? `tel:${settings.business.supportPhone}` : '/contact'}
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
