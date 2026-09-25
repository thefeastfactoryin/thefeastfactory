'use client';

import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  Home,
  LogIn,
  MapPin,
  Menu as MenuIcon,
  MessageCircle,
  MoreHorizontal,
  Package,
  ShoppingBag,
  UtensilsCrossed,
  User,
  Weight,
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
    href: '/order-by-kg',
    label: 'Order by KG',
    activeKey: '/order-by-kg',
    icon: Weight,
  },
  { href: '/menu', label: 'Menu', activeKey: '/menu', icon: BookOpen },
  { href: '/about', label: 'About Us', activeKey: '/about', icon: Home },
];

const mobilePrimaryLinks = [
  { href: '/', label: 'Home', icon: Home, activePaths: ['/'] },
  {
    href: '/packages',
    label: 'Packages',
    icon: Package,
    activePaths: ['/packages'],
  },
  {
    href: '/packages/meal-boxes',
    label: 'Meal Boxes',
    icon: UtensilsCrossed,
    activePaths: ['/packages/meal-boxes'],
  },
  {
    href: '/order-by-kg',
    label: 'Order by KG',
    icon: Weight,
    activePaths: ['/order-by-kg'],
  },
];

const mobileMoreActivePaths = ['/packages/build', '/menu'];

const productLinks = [
  { href: '/packages', label: 'Packages', icon: Package },
  { href: '/packages/meal-boxes', label: 'Meal Boxes', icon: UtensilsCrossed },
  { href: '/order-by-kg', label: 'Order by KG', icon: Weight },
  { href: '/packages/build', label: 'Build Your Menu', icon: UtensilsCrossed },
  { href: '/menu', label: 'Full Menu', icon: BookOpen },
  { href: '/cart', label: 'Cart', icon: ShoppingBag },
];

function matchesMobilePath(pathname: string, activePaths: string[]) {
  return activePaths.some((path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path),
  );
}

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
  const [accountOpen, setAccountOpen] = useState(false);
  const [desktopAccountOpen, setDesktopAccountOpen] = useState(false);

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
  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountOpen(false);
    setDesktopAccountOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!mobileMenuOpen && !accountOpen && !desktopAccountOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setAccountOpen(false);
        setDesktopAccountOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen, accountOpen, desktopAccountOpen]);

  const cartCount = mounted
    ? session
      ? activeCartCount
      : currentPackage
        ? 1
        : 0
    : 0;
  const cartActive = mounted && (cartCount > 0 || pathname === '/cart');
  const desktopLinks = navLinks;
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
    <div className="min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* ─── Desktop header ─── */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1536px] items-center justify-between gap-1.5 px-3 sm:h-[78px] sm:gap-3 sm:px-6 lg:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 md:flex-none">
            {/* Logo */}
            <Link
              href="/"
              className="flex min-h-11 min-w-11 shrink-0 items-center gap-2.5 sm:gap-3"
            >
              <img
                src="/logo.png"
                alt="The Feast Factory logo"
                className="h-9 w-9 shrink-0 rounded-md object-cover shadow-[0_4px_12px_rgba(122,31,43,0.14)] sm:h-14 sm:w-14"
              />
              <span className="flex min-w-0 max-w-[140px] flex-col sm:max-w-none">
                <span className="block truncate whitespace-nowrap font-serif text-[15px] font-semibold leading-[1.12] tracking-[-0.015em] text-primary sm:text-[18px] lg:text-[22px]">
                  The Feast Factory
                </span>
              </span>
            </Link>

            <div className="min-w-0 flex-1 [&>button]:max-w-full max-sm:[&>button]:w-full max-sm:[&>button]:gap-1 max-sm:[&>button]:px-1 md:flex-none">
              <DeliveryLocationSelector active variant="header" />
            </div>
          </div>

          {/* Desktop nav */}
          <nav
            className="hidden items-center gap-1 xl:flex"
            aria-label="Main navigation"
          >
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
                    'relative whitespace-nowrap px-2.5 py-2 text-[13.5px] font-semibold tracking-[0.005em] transition-colors duration-250 ease-premium 2xl:px-3.5',
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
          <div className="relative hidden shrink-0 items-center gap-1.5 md:flex md:gap-2">
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
            {session ? (
              <button
                type="button"
                aria-label="Profile menu"
                aria-expanded={desktopAccountOpen}
                aria-controls="desktop-account-menu"
                onClick={() => setDesktopAccountOpen((open) => !open)}
                className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <User className="h-5 w-5" />
              </button>
            ) : (
              <Link
                href="/login"
                aria-label="Sign in"
                className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogIn className="h-5 w-5" />
              </Link>
            )}
            {session && desktopAccountOpen && (
              <nav
                id="desktop-account-menu"
                aria-label="Profile menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl"
              >
                {[
                  { href: '/profile', label: 'My Profile', icon: User },
                  {
                    href: '/orders',
                    label: 'My Orders',
                    icon: ClipboardList,
                  },
                  {
                    href: '/addresses',
                    label: 'Saved addresses',
                    icon: MapPin,
                  },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDesktopAccountOpen(false)}
                    aria-current={pathname === href ? 'page' : undefined}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground/80 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex shrink-0 items-center md:hidden">
            <Link
              href="/cart"
              aria-label={`Cart — ${cartCount} packages`}
              className="relative grid h-11 w-11 place-items-center rounded-full text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={() => {
                setAccountOpen(false);
                setMobileMenuOpen(false);
              }}
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Account and help"
              aria-expanded={accountOpen}
              aria-controls="mobile-account-menu"
              onClick={() => {
                setMobileMenuOpen(false);
                setAccountOpen((open) => !open);
              }}
            >
              <User className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:grid xl:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="tablet-header-menu"
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
            id="tablet-header-menu"
            className="hidden grid-cols-2 gap-2 border-t border-border bg-white px-4 py-3 shadow-[0_12px_28px_rgba(45,31,20,0.08)] md:grid xl:hidden"
            aria-label="Expanded tablet navigation"
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

      {accountOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            className="absolute inset-0 bg-black/30"
            aria-label="Close account menu"
            onClick={() => setAccountOpen(false)}
          />
          <nav
            id="mobile-account-menu"
            aria-label="Account and help"
            className="absolute right-3 top-16 max-h-[calc(100dvh-6rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-xl"
          >
            <div className="flex items-center justify-between pl-3">
              <p className="font-sans text-lg font-semibold">Account & help</p>
              <button
                aria-label="Close account menu"
                className="grid h-11 w-11 place-items-center"
                onClick={() => setAccountOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {[
              ...(session
                ? [
                    { href: '/profile', label: 'My Profile', icon: User },
                    {
                      href: '/orders',
                      label: 'My Orders',
                      icon: ClipboardList,
                    },
                    {
                      href: '/addresses',
                      label: 'Saved addresses',
                      icon: MapPin,
                    },
                  ]
                : [{ href: '/login', label: 'Sign in', icon: LogIn }]),
              { href: '/faq', label: 'Help & FAQ', icon: CircleHelp },
              { href: '/contact', label: 'Contact us', icon: MessageCircle },
              { href: '/about', label: 'About Us', icon: Home },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setAccountOpen(false)}
                aria-current={pathname === href ? 'page' : undefined}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 bg-black/35 md:hidden"
            aria-label="Close more navigation"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav
            id="mobile-more-menu"
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 max-h-[min(70vh,34rem)] overflow-y-auto rounded-3xl border border-border bg-card p-3 shadow-[0_24px_70px_rgba(32,20,14,0.28)] md:hidden"
            aria-label="More navigation"
          >
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <div>
                <p className="font-sans text-xl font-semibold">Explore more</p>
                <p className="text-xs text-muted-foreground">
                  Find your food and build your order
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Close more navigation"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {productLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    pathname === href ||
                      (href !== '/' && pathname.startsWith(href))
                      ? 'border-primary/20 bg-primary/[0.08] text-primary'
                      : 'border-border bg-background text-foreground/80 hover:border-primary/20 hover:text-primary',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}

      {/* ─── Mobile bottom nav ─── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[60] grid min-h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border/80 bg-card/95 pb-[max(.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(45,31,20,0.10)] backdrop-blur-xl md:hidden"
        aria-label="Primary mobile navigation"
      >
        {mobilePrimaryLinks.map(({ href, label, icon: Icon, activePaths }) => {
          const active =
            matchesMobilePath(pathname, activePaths) &&
            !(
              href === '/packages' &&
              (pathname.startsWith('/packages/meal-boxes') ||
                pathname.startsWith('/packages/build'))
            );
          return (
            <Link
              key={href + label}
              href={href}
              className={cn(
                'group relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-1 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 active:scale-[0.97]',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
              aria-label={`${label}${active ? ', current page' : ''}`}
            >
              <span
                className={cn(
                  'grid h-7 min-w-10 place-items-center rounded-full px-2 transition-colors',
                  active
                    ? 'bg-primary/[0.10] text-primary'
                    : 'group-hover:bg-muted',
                )}
              >
                <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
              </span>
              <span>{label}</span>
              {href === '/cart' && cartCount > 0 && (
                <span className="absolute right-[18%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-extrabold text-accent-foreground shadow-sm">
                  {cartCount}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setAccountOpen(false);
            setMobileMenuOpen((open) => !open);
          }}
          className={cn(
            'group relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-1 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 active:scale-[0.97]',
            mobileMenuOpen || matchesMobilePath(pathname, mobileMoreActivePaths)
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-more-menu"
          aria-label={
            mobileMenuOpen ? 'Close more navigation' : 'Open more navigation'
          }
        >
          <span
            className={cn(
              'grid h-7 min-w-10 place-items-center rounded-full px-2 transition-colors',
              mobileMenuOpen ||
                matchesMobilePath(pathname, mobileMoreActivePaths)
                ? 'bg-primary/[0.10] text-primary'
                : 'group-hover:bg-muted',
            )}
          >
            {mobileMenuOpen ? (
              <X className="h-[19px] w-[19px]" aria-hidden="true" />
            ) : (
              <MoreHorizontal
                className="h-[19px] w-[19px]"
                aria-hidden="true"
              />
            )}
          </span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
