'use client';

import {
  BookOpen,
  ClipboardList,
  Home,
  LogIn,
  Package,
  ShoppingBag,
  User,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { CartSummary } from '@aranyam/shared-types';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useOrderBuilderStore } from '../store/order-builder.store';
import { useSessionStore } from '../store/session.store';
import { cn } from '../lib/utils';
import { Footer } from './home/footer';
import { apiRequest } from '../lib/api';

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
  { href: '/menu', label: 'Menu', icon: BookOpen },
  { href: '/packages', label: 'Packages', icon: Package },
];

const WhatsAppConcierge = dynamic(
  () => import('./WhatsAppConcierge').then((module) => module.WhatsAppConcierge),
  { ssr: false },
);

export function CustomerShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const session = useSessionStore((s) => s.session);
  const cartPackage = useOrderBuilderStore((s) => s.package);
  const hydrateFromCart = useOrderBuilderStore((s) => s.hydrateFromCart);
  const [mounted, setMounted] = useState(false);
  const [conciergeReady, setConciergeReady] = useState(false);
  const [storesHydrated, setStoresHydrated] = useState(false);
  const [serverCartConflict, setServerCartConflict] = useState<CartSummary>();
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [conflictError, setConflictError] = useState('');
  const [activeCartCount, setActiveCartCount] = useState(0);
  const cartRefreshVersion = useRef(0);

  useEffect(() => {
    setMounted(true);
    Promise.all([
      useSessionStore.persist.rehydrate(),
      useOrderBuilderStore.persist.rehydrate(),
    ]).finally(() => setStoresHydrated(true));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setConciergeReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!storesHydrated || !session) return;
    let active = true;
    const refreshVersion = cartRefreshVersion.current;
    const local = useOrderBuilderStore.getState();
    if (local.ownerUserId && local.ownerUserId !== session.user.id) {
      local.reset();
    }
    Promise.all([
      apiRequest<CartSummary | null>('/cart', {}, session.accessToken),
      apiRequest<CartSummary[]>('/cart/all', {}, session.accessToken),
    ])
      .then(([cart, carts]) => {
        if (!active || refreshVersion !== cartRefreshVersion.current) return;
        setActiveCartCount(carts.length);
        const current = useOrderBuilderStore.getState();
        if (!cart) {
          if (current.draftSource === 'server') current.reset();
          return;
        }
        if (current.draftSource === 'guest' && current.package) {
          setServerCartConflict(cart);
          return;
        }
        hydrateFromCart(cart, session.user.id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session, storesHydrated, hydrateFromCart, pathname]);

  useEffect(() => {
    if (!session) {
      setActiveCartCount(0);
      return;
    }
    const refresh = () => {
      cartRefreshVersion.current += 1;
      void apiRequest<CartSummary[]>('/cart/all', {}, session.accessToken)
        .then((carts) => {
          setActiveCartCount(carts.length);
          if (
            carts.length === 0 &&
            useOrderBuilderStore.getState().draftSource === 'server'
          ) {
            useOrderBuilderStore.getState().reset();
          }
        })
        .catch(() => {});
    };
    window.addEventListener('cart-updated', refresh);
    return () => window.removeEventListener('cart-updated', refresh);
  }, [session]);

  async function useGuestDraft() {
    if (!session) return;
    const draft = useOrderBuilderStore.getState();
    if (!draft.package) return;
    setResolvingConflict(true);
    setConflictError('');
    try {
      const created = await apiRequest<CartSummary>(
        '/cart',
        {
          method: 'POST',
          body: JSON.stringify({
            packageVersionId: draft.package.packageVersionId,
            guestCount: draft.guestCount || draft.package.minGuestCount,
          }),
        },
        session.accessToken,
      );
      await apiRequest(
        `/cart/${created.id}/items`,
        {
          method: 'PUT',
          body: JSON.stringify({
            items: draft.selectedItems.map((item) => ({
              categoryId: item.categoryId,
              menuItemId: item.menuItemId,
              replacedMenuItemId: item.replacedMenuItemId,
              role:
                item.role ??
                (item.replacedMenuItemId
                  ? 'SWAP'
                  : draft.package?.packageType === 'FIXED_PACKAGE'
                    ? 'EXTRA'
                    : 'CUSTOM'),
              quantity: item.quantity ?? 1,
            })),
          }),
        },
        session.accessToken,
      );
      const saved = await apiRequest<CartSummary>(
        `/cart/${created.id}`,
        {},
        session.accessToken,
      );
      hydrateFromCart(saved, session.user.id);
      window.dispatchEvent(new Event('cart-updated'));
      setServerCartConflict(undefined);
    } catch (reason) {
      setConflictError((reason as Error).message);
    } finally {
      setResolvingConflict(false);
    }
  }

  function resumeServerCart() {
    if (!session || !serverCartConflict) return;
    hydrateFromCart(serverCartConflict, session.user.id);
    setConflictError('');
    setServerCartConflict(undefined);
  }

  const cartCount = mounted ? activeCartCount : 0;
  const cartActive = mounted && (Boolean(cartPackage) || pathname === '/cart');
  const desktopLinks = session
    ? navLinks
    : navLinks.filter((link) => link.href !== '/orders');

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* ─── Desktop header ─── */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[62px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[66px] sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
            <img
              src="/logo.png"
              alt=""
              className="h-10 w-10 rounded-md object-cover shadow-[0_4px_12px_rgba(122,31,43,0.14)] sm:h-[46px] sm:w-[46px]"
            />
            <span className="hidden sm:flex sm:flex-col">
              <span className="block font-serif text-[18px] font-semibold leading-none tracking-[-0.01em] text-primary">
                The Feast Factory
              </span>
            </span>
          </Link>

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
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Cart */}
            {session && (
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
            )}

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
        </div>
      </header>

      {children}

      <Footer />
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

      {serverCartConflict && cartPackage && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cart-conflict-title"
        >
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <h2
              id="cart-conflict-title"
              className="mt-4 font-serif text-2xl font-bold"
            >
              Which cart should we use?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This device has <strong>{cartPackage.packageName}</strong>, while
              your account has{' '}
              <strong>{serverCartConflict.package.name}</strong>. Nothing will
              be replaced without your choice.
            </p>
            {conflictError && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                {conflictError}
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={resumeServerCart}
                disabled={resolvingConflict}
                className="rounded-xl border px-4 py-3 text-sm font-bold hover:bg-muted disabled:opacity-60"
              >
                Resume saved cart
              </button>
              <button
                type="button"
                onClick={useGuestDraft}
                disabled={resolvingConflict}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {resolvingConflict ? 'Saving…' : 'Use this draft'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
