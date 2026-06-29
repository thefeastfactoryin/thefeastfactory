'use client';

import {
  Bell,
  BookOpen,
  ClipboardList,
  Home,
  LogIn,
  Menu,
  Package,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useSessionStore } from '../store/session.store';
import { apiRequest } from '../lib/api';
import { cn } from '../lib/utils';
import { Footer } from './home/footer';

const navLinks = [
  { href: '/', label: 'Home', activeKey: '/', icon: Home },
  { href: '/menu', label: 'Menu', activeKey: '/menu', icon: BookOpen },
  { href: '/packages', label: 'Packages', activeKey: '/packages', icon: Package },
  { href: '/packages/meal-boxes', label: 'Meal Boxes', activeKey: '/packages/meal-boxes', icon: Package },
  { href: '/orders', label: 'Orders', activeKey: '/orders', icon: ClipboardList },
  { href: '/about', label: 'About Us', activeKey: '/about', icon: Home },
];

const mobileLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/menu', label: 'Menu', icon: BookOpen },
  { href: '/packages', label: 'Packages', icon: Package },
];

export function CustomerShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const session = useSessionStore((s) => s.session);
  const selectedItems = useOrderBuilderStore((s) => s.selectedItems);
  const cartPackage = useOrderBuilderStore((s) => s.package);
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!session) { setUnread(0); return; }
    apiRequest<{ count: number }>('/me/notifications/unread-count', {}, session.accessToken)
      .then((r) => setUnread(r.count))
      .catch(() => undefined);
  }, [session, pathname]);

  const cartCount = mounted ? selectedItems.length : 0;
  const cartActive = mounted && (Boolean(cartPackage) || pathname === '/cart');

  return (
    <div className="min-h-screen overflow-x-hidden pb-20 md:pb-0">

      {/* ─── Desktop header ─── */}
      <header
        className="sticky top-0 z-40 border-b border-[hsl(35_22%_88%)] backdrop-blur-xl"
        style={{ background: 'rgba(255,255,255,0.97)' }}
      >
        <div className="mx-auto flex h-[62px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[66px] sm:px-6 lg:px-8">

          {/* Logo */}
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
            <img
              src="/logo.png"
              alt=""
              className="h-10 w-10 rounded-md object-cover shadow-[0_4px_12px_rgba(122,31,43,0.14)] sm:h-[46px] sm:w-[46px]"
            />
            <span className="hidden sm:flex sm:flex-col">
              <span
                className="block font-serif text-[18px] font-semibold leading-none tracking-[-0.01em]"
                style={{ color: 'hsl(352 59% 30%)' }}
              >
                The Feast Factory
              </span>
              <span
                className="mt-1 block text-[9.5px] font-medium uppercase tracking-[0.16em]"
                style={{ color: 'hsl(0 0% 55%)' }}
              >
                Curated Food Experiences
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1.5 md:flex">
            {navLinks.map(({ href, label, activeKey }) => {
              const selfMatch = activeKey === '/' ? pathname === '/' : pathname.startsWith(activeKey);
              const moreSpecificMatch = selfMatch && navLinks.some(
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
                    'relative px-3 py-2 text-[13.5px] font-semibold tracking-[0.005em] transition-colors duration-250 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] lg:px-3.5',
                    active
                      ? 'text-primary'
                      : 'text-foreground/70 hover:text-foreground',
                  )}
                >
                  {label}
                  {/* Thin underline indicator for active link */}
                  {active && (
                    <span
                      className="absolute inset-x-3 bottom-0 h-[2px] rounded-full lg:inset-x-3.5"
                      style={{ background: 'hsl(41 56% 51%)' }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full border border-[hsl(35_22%_86%)] bg-card text-foreground shadow-[0_4px_14px_rgba(34,20,12,0.045)] transition-colors hover:border-primary/35 hover:text-primary md:hidden"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Notification bell */}
            {session && (
              <Link
                href="/notifications"
                className="relative grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`${unread} unread notifications`}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span
                    className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-extrabold"
                    style={{ background: 'hsl(41 56% 51%)', color: 'hsl(0 0% 8%)' }}
                  >
                    {unread}
                  </span>
                )}
              </Link>
            )}

            {/* Cart */}
            <Link
              href="/cart"
              aria-label={`Cart - ${cartCount} items selected`}
              className={cn(
                'relative flex h-11 items-center gap-2 rounded-full px-3 text-[13px] font-bold transition-all duration-250 [transition-timing-function:cubic-bezier(.22,.61,.36,1)] sm:px-4',
                cartActive
                  ? 'text-white shadow-[0_10px_24px_rgba(122,31,43,0.18)]'
                  : 'border border-[hsl(35_22%_86%)] bg-card text-foreground shadow-[0_4px_14px_rgba(34,20,12,0.045)] hover:border-primary/35 hover:text-primary hover:shadow-[0_8px_20px_rgba(122,31,43,0.10)]',
              )}
              style={cartActive ? { background: 'hsl(352 59% 30%)' } : {}}
            >
              <ShoppingBag className="h-[15px] w-[15px] shrink-0" strokeWidth={2.4} />
              <span className="hidden sm:inline">Your cart</span>
              {cartCount > 0 && (
                <span
                  className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-extrabold"
                  style={{
                    background: 'hsl(41 56% 51%)',
                    color: 'hsl(0 0% 8%)',
                  }}
                >
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
              {session ? <User className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            </Link>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border bg-white/98 px-4 py-3 shadow-[0_14px_32px_rgba(34,20,12,0.10)] md:hidden">
            <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Mobile navigation">
              {navLinks.map(({ href, label, activeKey, icon: Icon }) => {
                const selfMatch = activeKey === '/' ? pathname === '/' : pathname.startsWith(activeKey);
                const moreSpecificMatch = selfMatch && navLinks.some(
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
                      'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground/75 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {children}

      <Footer />

      {/* ─── Mobile bottom nav ─── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border backdrop-blur md:hidden"
        style={{ background: 'rgba(255,255,255,0.97)' }}
      >
        {[
          ...mobileLinks,
          { href: '/cart', label: 'Cart', icon: ShoppingBag },
          { href: session ? '/profile' : '/login', label: session ? 'Profile' : 'Login', icon: session ? User : LogIn },
        ].map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href + label}
              href={href}
              className={cn(
                'relative flex min-h-16 flex-col items-center justify-center gap-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-[11px] font-semibold transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
              {href === '/cart' && cartCount > 0 && (
                <span
                  className="absolute right-[18%] top-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-extrabold"
                  style={{ background: 'hsl(41 56% 51%)', color: 'hsl(0 0% 8%)' }}
                >
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
