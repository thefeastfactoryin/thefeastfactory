'use client';

import { adminCopy, appBrand } from '@aranyam/shared-types';
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  Home,
  LogOut,
  Package,
  Settings,
  Utensils,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import brandLogo from '../../customer-web/public/logo.png';
import { useAdminSessionStore } from '../store/session.store';
import { cn } from '../lib/utils';

const links = [
  [adminCopy.navigation.dashboard, '/admin/dashboard', BarChart3],
  [adminCopy.navigation.homePage, '/admin/homepage', Home],
  [adminCopy.navigation.orders, '/admin/orders', ClipboardList],
  [adminCopy.navigation.menu, '/admin/menu/items', Utensils],
  [adminCopy.navigation.packages, '/admin/packages', Package],
  [adminCopy.navigation.payments, '/admin/payments', CreditCard],
  [adminCopy.navigation.settings, '/admin/settings', Settings],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAdminSessionStore((state) => state.session);
  const hasHydrated = useAdminSessionStore((state) => state.hasHydrated);
  const clear = useAdminSessionStore((state) => state.clear);
  const isLogin = pathname === '/admin/login' || pathname === '/';

  useEffect(() => {
    if (!isLogin && hasHydrated && !session) {
      router.replace('/admin/login');
    }
  }, [hasHydrated, isLogin, router, session]);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-16 items-center gap-4 px-4 py-3 md:px-7">
          <Link
            href="/admin/dashboard"
            className="flex min-w-fit items-center gap-3"
          >
            <Image
              src={brandLogo}
              alt=""
              className="h-10 w-10 rounded-xl object-cover shadow-elevated"
            />
            <span className="hidden sm:block">
              <span className="block font-serif text-lg font-semibold leading-tight text-primary">
                {appBrand.name}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Curated operations
              </span>
            </span>
          </Link>

          <nav
            className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1"
            aria-label="Admin navigation"
          >
            {links.map(([label, href, Icon]) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex min-w-fit items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition',
                    active
                      ? 'bg-primary text-white shadow-elevated'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right lg:block">
              <p className="text-sm font-semibold">
                {session?.admin.name ?? 'Not signed in'}
              </p>
              <p className="text-xs text-muted-foreground">
                {session?.admin.role ?? 'Admin'}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-xl border p-2 text-muted-foreground hover:border-red-200 hover:text-red-600"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
