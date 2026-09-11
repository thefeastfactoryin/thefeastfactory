'use client';

import {
  BookOpen,
  ClipboardList,
  Home,
  LogIn,
  Menu as MenuIcon,
  Package,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { CartSummary } from '@aranyam/shared-types';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session.store';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { cn } from '../lib/utils';
import { Footer } from './home/footer';
import { apiRequest } from '../lib/api';
import { DeliveryLocationSelector } from './delivery-location-selector';

const navLinks = [
  { href: '/', label: 'Home', activeKey: '/', icon: Home },
  {
    href: '/packages',
    label: 'Packages',
    activeKey: '/packages',
    icon: Package,
  },
  {
    href: '/packages/meal-boxes',
    label: 'Meal Boxes',
    activeKey: '/packages/meal-boxes',
    icon: Package,
  },
  {
    href: '/orders',
    label: 'Orders',
    activeKey: '/orders',
    icon: ClipboardList,
  },
  { href: '/menu', label: 'Menu', activeKey: '/menu', icon: BookOpen },
  { href: '/about', label: 'About Us', activeKey: '/about', icon: Home },
];

const mobileLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/packages', label: 'Packages', icon: Package },
  { href: '/packages/meal-boxes', label: 'Meal Boxes', icon: Package },
];

const WhatsAppConcierge = dynamic(
  () =>
    import('./WhatsAppConcierge').then((module) => module.WhatsAppConcierge),
  { ssr: false },
);

export function CustomerShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const session = useSessionStore((s) => s.session);
  const currentPackage = useOrderBuilderStore((state) => state.package);
  const [mounted, setMounted] = useState(false);
  const [conciergeReady, setConciergeReady] = useState(false);
  const [activeCartCount, setActiveCartCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    window.localStorage.removeItem('aranyam-order-cart');
    void useSessionStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setConciergeReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!session) {
      setActiveCartCount(0);
      return;
    }
    let active = true;
    const refresh = () => {
      void apiRequest<CartSummary[]>('/cart/all', {}, session.accessToken)
        .then((carts) => {
          if (active) setActiveCartCount(carts.length);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener('cart-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('cart-updated', refresh);
    };
  }, [pathname, session]);

  const cartCount = mounted
    ? session
      ? activeCartCount
      : currentPackage
        ? 1
        : 0
    : 0;
  const cartActive = mounted && (cartCount > 0 || pathname === '/cart');
  const desktopLinks = session
    ? navLinks
    : navLinks.filter((link) => link.href !== '/orders');
  const isFocusedFlow = [
    '/packages/build',
    '/menu/select',
    '/cart',
    '/login',
    '/otp',
    '/payment',
    '/orders',
    '/profile',
    '/addresses',
  ].some((route) => pathname.startsWith(route));

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* ─── Desktop header ─── */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-[1536px] items-center justify-between gap-3 px-4 sm:h-[78px] sm:px-6 lg:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
            {/* Logo */}
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2.5 sm:gap-3"
            >
              <img
                src="/logo.png"
                alt="The Feast Factory logo"
                className="h-9 w-9 shrink-0 rounded-md object-cover shadow-[0_4px_12px_rgba(122,31,43,0.14)] sm:h-14 sm:w-14"
              />
              <span className="flex min-w-0 flex-col">
                <span className="block truncate whitespace-nowrap font-serif text-[15px] font-semibold leading-none tracking-normal text-primary sm:text-[22px]">
                  The Feast Factory
                </span>
              </span>
            </Link>

            <DeliveryLocationSelector active variant="header" />
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {desktopLinks.map(({ href, label, activeKey }) => {
              const selfMatch =
                activeKey === '/'
                  ? pathname === '/'
                  : pathname.startsWith(activeKey);
              // If a more specific nav entry also matches, this one is not active
              const moreSpecificMatch =
                selfMatch &&
                desktopLinks.some(
                  (other) =>
                    other.activeKey !== activeKey &&
                    other.activeKey.startsWith(activeKey) &&
                    pathname.startsWith(other.activeKey),
                );
              const active = selfMatch && !moreSpecificMatch;
              return (
                <Link
                  key={label}
                  href={href}
                  className={cn(
                    'relative px-3 py-2 text-[13.5px] font-semibold tracking-[0.005em] transition-colors duration-250 ease-premium lg:px-3.5',
                    active
                      ? 'text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent lg:after:inset-x-3.5'
                      : 'text-foreground/70 hover:text-foreground',
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="hidden shrink-0 items-center gap-1.5 md:flex md:gap-2">
            {/* Cart */}
            <Link
              href="/cart"
              aria-label={`Cart — ${cartCount} packages`}
              className={cn(
                'relative flex h-11 items-center gap-2 rounded-full px-3 text-[13px] font-bold transition-all duration-250 ease-premium sm:px-4',
                cartActive
                  ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(122,31,43,0.18)]'
                  : 'border border-border bg-card text-foreground shadow-[0_4px_14px_rgba(34,20,12,0.045)] hover:border-primary/35 hover:text-primary hover:shadow-[0_8px_20px_rgba(122,31,43,0.10)]',
              )}
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Your cart</span>
              {cartCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-extrabold text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Login / Profile */}
            <Link
              href={session ? '/profile' : '/login'}
              aria-label={session ? 'Profile' : 'Sign in'}
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              {session ? (
                <User className="h-5 w-5" />
              ) : (
                <LogIn className="h-5 w-5" />
              )}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-header-menu"
            aria-label={
              mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <MenuIcon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-header-menu"
            className="grid grid-cols-2 gap-2 border-t border-border bg-white px-4 py-3 shadow-[0_12px_28px_rgba(45,31,20,0.08)] md:hidden"
            aria-label="Expanded mobile navigation"
          >
            {desktopLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href + label}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors',
                  pathname === href ||
                    (href !== '/' && pathname.startsWith(href))
                    ? 'bg-primary/[0.08] text-primary'
                    : 'text-foreground/75 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            ))}
            <Link
              href="/cart"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-foreground/75 transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />
              Cart
              {cartCount > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-extrabold text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link
              href={session ? '/profile' : '/login'}
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-foreground/75 transition-colors hover:bg-muted hover:text-foreground"
            >
              {session ? (
                <User className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {session ? 'Profile' : 'Login'}
            </Link>
          </nav>
        )}
      </header>

      {children}

      <div className={isFocusedFlow ? 'hidden lg:block' : ''}>
        <Footer />
      </div>
      {conciergeReady && <WhatsAppConcierge />}

      {/* ─── Mobile bottom nav ─── */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-50 grid ${session ? 'grid-cols-5' : 'grid-cols-4'} border-t border-border bg-card/97 backdrop-blur md:hidden`}
      >
        {[
          ...mobileLinks,
          ...(session
            ? [{ href: '/cart', label: 'Cart', icon: ShoppingBag }]
            : []),
          {
            href: session ? '/profile' : '/login',
            label: session ? 'Profile' : 'Login',
            icon: session ? User : LogIn,
          },
        ].map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href + label}
              href={href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
              {href === '/cart' && cartCount > 0 && (
                <span className="absolute right-[18%] top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-extrabold text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
