'use client';

import { adminCopy, appBrand } from '@aranyam/shared-types';
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  Utensils,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import brandLogo from '../../customer-web/public/logo.png';
import { cn } from '../lib/utils';
import { useAdminSessionStore } from '../store/session.store';

const navigationGroups = [
  {
    label: 'Operations',
    links: [
      [adminCopy.navigation.dashboard, '/admin/dashboard', BarChart3],
      [adminCopy.navigation.orders, '/admin/orders', ClipboardList],
      [adminCopy.navigation.payments, '/admin/payments', CreditCard],
    ],
  },
  {
    label: 'Catalog',
    links: [
      [adminCopy.navigation.menu, '/admin/menu/items', Utensils],
      [adminCopy.navigation.packages, '/admin/packages', Package],
      [adminCopy.navigation.homePage, '/admin/homepage', Home],
    ],
  },
  {
    label: 'Configuration',
    links: [[adminCopy.navigation.settings, '/admin/settings', Settings]],
  },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAdminSessionStore((state) => state.session);
  const hasHydrated = useAdminSessionStore((state) => state.hasHydrated);
  const clear = useAdminSessionStore((state) => state.clear);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isLogin = pathname === '/admin/login' || pathname === '/';

  useEffect(() => {
    if (!isLogin && hasHydrated && !session) {
      router.replace('/admin/login');
    }
  }, [hasHydrated, isLogin, router, session]);

  useEffect(() => setMobileNavOpen(false), [pathname]);

  if (isLogin) return <>{children}</>;
  if (!hasHydrated || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5 text-center">
        <div>
          <p className="font-serif text-2xl font-semibold text-primary">
            The Feast Factory
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Checking admin session...
          </p>
        </div>
      </div>
    );
  }

  function logout() {
    clear();
    router.push('/admin/login');
  }

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === href;
    const section = href.split('/').slice(0, 3).join('/');
    return pathname === href || pathname.startsWith(`${section}/`);
  }

  const navigation = (
    <>
      <Link
        href="/admin/dashboard"
        className="flex min-w-fit items-center gap-3 border-b px-5 py-5"
      >
        <Image
          src={brandLogo}
          alt=""
          className="h-11 w-11 rounded-lg object-cover shadow-elevated"
        />
        <span>
          <span className="block font-serif text-lg font-semibold leading-tight text-primary">
            {appBrand.name}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Admin operations
          </span>
        </span>
      </Link>

      <nav
        className="flex-1 overflow-y-auto px-3 py-5"
        aria-label="Admin navigation"
      >
        {navigationGroups.map((group) => (
          <div className="mb-6" key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.links.map(([label, href, Icon]) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-primary text-white'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {session.admin.name ?? 'Administrator'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.admin.role}
              {session.admin.region?.name
                ? ` - ${session.admin.region.name}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border text-muted-foreground hover:border-red-200 hover:text-red-600"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-white lg:flex">
        {navigation}
      </aside>

      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:hidden">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <Image
            src={brandLogo}
            alt=""
            className="h-10 w-10 rounded-lg object-cover"
          />
          <span className="font-serif text-lg font-semibold text-primary">
            {appBrand.name}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="grid h-11 w-11 place-items-center rounded-lg border"
          aria-label="Open admin navigation"
          aria-expanded={mobileNavOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin navigation"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-lg border bg-white"
              aria-label="Close admin navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {navigation}
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-64">{children}</div>
    </div>
  );
}
