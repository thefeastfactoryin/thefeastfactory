'use client';

import { businessInfo } from '@aranyam/shared-types';
import { Facebook, Instagram, Mail, MapPin, Phone, UtensilsCrossed } from 'lucide-react';
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
  { href: '/packages/build', label: 'Build Your Own Menu' },
  { href: '/packages', label: 'Corporate Catering' },
];

export function Footer() {
  const settings = usePublicSettings();
  const socialIcons = { Instagram, Facebook } as const;
  return (
    <footer className="bg-foreground text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
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
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-white/50">
              Contact
            </p>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {settings?.business.supportPhone || 'Contact details being updated'}
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {settings?.business.supportEmail || 'Support email being updated'}
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {settings?.business.address || 'Service address being updated'}
              </li>
            </ul>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} The Feast Factory. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs text-white/40">
            <Link href="/privacy" className="hover:text-white/70">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/70">Terms of Service</Link>
            <Link href="/cancellation-policy" className="hover:text-white/70">Cancellation Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
