'use client';

import { businessInfo } from '@aranyam/shared-types';
import {
  ChevronDown,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { usePublicSettings } from '../public-settings-provider';

const quickLinks = [
  { href: '/', label: 'Home' },
  { href: '/menu', label: 'Browse Menu' },
  { href: '/packages', label: 'Packages' },
  { href: '/orders', label: 'My Orders' },
];

const services = [
  { href: '/packages/meal-boxes', label: 'Meal Boxes' },
  { href: '/packages', label: 'Occasion Packages' },
  { href: '/order-by-kg', label: 'Order by KG' },
  { href: '/packages/build', label: 'Build Your Own Menu' },
  { href: '/packages', label: 'Corporate Catering' },
];

export function Footer() {
  const settings = usePublicSettings();
  const socialIcons = { Instagram, Facebook } as const;
  const contactItems = [
    {
      icon: Phone,
      label: 'Phone',
      value: settings?.business.supportPhone,
    },
    {
      icon: Mail,
      label: 'Email',
      value: settings?.business.supportEmail,
    },
    {
      icon: MapPin,
      label: 'Address',
      value: settings?.business.address,
    },
  ].filter((item) => Boolean(item.value));
  return (
    <footer className="bg-foreground text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 md:py-8 lg:px-8">
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-4 pb-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary">
                <UtensilsCrossed className="h-4 w-4 text-white" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight text-white">
                  The Feast Factory
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-white/50">
                  Bulk Catering
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {businessInfo.socials.map((social) => {
                const Icon =
                  socialIcons[social.label as keyof typeof socialIcons];
                if (!Icon) return null;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-accent hover:text-accent"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <details className="group border-t border-white/10">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
              Quick Links
              <ChevronDown className="h-4 w-4 text-white/50 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3 pb-5">
              {quickLinks.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/65">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>

          <details className="group border-t border-white/10">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
              Our Services
              <ChevronDown className="h-4 w-4 text-white/50 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="space-y-3 pb-5">
              {services.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/65">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>

          {contactItems.length > 0 && (
            <details className="group border-y border-white/10">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                Contact
                <ChevronDown className="h-4 w-4 text-white/50 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="space-y-3 pb-5 text-sm text-white/65">
                {contactItems.map(({ icon: Icon, label, value }) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {value}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="hidden gap-10 md:grid md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight text-white">The Feast Factory</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  Bulk Catering
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-white/60">
              Premium bulk catering for corporate offices, communities, and
              celebrations with transparent pricing and on-time delivery.
            </p>
            <div className="mt-5 flex gap-3">
              {businessInfo.socials.map((social) => {
                const Icon = socialIcons[social.label as keyof typeof socialIcons];
                if (!Icon) return null;
                return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-accent hover:text-accent"
                >
                  <Icon className="h-4 w-4" />
                </a>
                );
              })}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-white/50">
              Quick Links
            </p>
            <ul className="space-y-3">
              {quickLinks.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/70 transition-colors hover:text-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-white/50">
              Our Services
            </p>
            <ul className="space-y-3">
              {services.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/70 transition-colors hover:text-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          {contactItems.length > 0 && (
            <div>
              <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-white/50">
                Contact
              </p>
              <ul className="space-y-3 text-sm text-white/70">
                {contactItems.map(({ icon: Icon, label, value }) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Divider + copyright */}
        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-center sm:flex-row sm:text-left md:mt-12 md:gap-4 md:pt-8">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} The Feast Factory. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-white/40 sm:justify-end md:gap-5">
            <Link href="/privacy" className="hover:text-white/70">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/70">Terms of Service</Link>
            <Link href="/cancellation-policy" className="hover:text-white/70">Cancellation Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
