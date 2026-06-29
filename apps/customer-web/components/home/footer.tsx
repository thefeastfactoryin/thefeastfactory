import {
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Twitter,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';

const quickLinks = [
  { href: '/', label: 'Home' },
  { href: '/packages', label: 'Packages' },
  { href: '/packages/meal-boxes', label: 'Meal Boxes' },
  { href: '/menu', label: 'Browse Menu' },
  { href: '/orders', label: 'My Orders' },
];

const services = [
  { href: '/packages', label: 'Occasion Packages' },
  { href: '/packages/meal-boxes', label: 'Corporate Meal Boxes' },
  { href: '/menu', label: 'Build Your Own Menu' },
  { href: '/packages', label: 'Community Catering' },
];

const trustNotes = [
  '48-hour minimum booking window',
  'Transparent package pricing',
  'Secure Razorpay checkout',
];

export function Footer() {
  return (
    <footer className="bg-foreground text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.8fr_0.9fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="font-serif text-base font-bold leading-tight">
                  The Feast Factory
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                  Bulk Catering
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/60">
              Premium bulk catering for Indian celebrations, office meals, and
              community gatherings. Built for clear choices, dependable delivery,
              and easy ordering.
            </p>
            <div className="mt-5 flex gap-3">
              {[Twitter, Instagram, Linkedin].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  aria-label="The Feast Factory social profile"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/60 transition hover:border-accent hover:text-accent"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-white/40">
              Quick Links
            </p>
            <ul className="space-y-3">
              {quickLinks.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/60 transition hover:text-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-white/40">
              Services
            </p>
            <ul className="space-y-3">
              {services.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/60 transition hover:text-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-white/40">
              Contact
            </p>
            <ul className="space-y-3 text-sm text-white/60">
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                +91 98765 43210
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                orders@thefeastfactory.in
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                Bengaluru, Karnataka, India
              </li>
            </ul>

            <div className="mt-6 space-y-2 border-t border-white/10 pt-5">
              {trustNotes.map((note) => (
                <p key={note} className="flex items-center gap-2 text-xs text-white/60">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  {note}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-7 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright {new Date().getFullYear()} The Feast Factory. All rights reserved.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="#" className="transition hover:text-white/70">
              Privacy Policy
            </Link>
            <Link href="#" className="transition hover:text-white/70">
              Terms of Service
            </Link>
            <Link href="#" className="transition hover:text-white/70">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
