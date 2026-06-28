'use client';

import { adminCopy, appBrand } from '@aranyam/shared-types';
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  CreditCard,
  LogOut,
  Menu,
  Package,
  Settings,
  Utensils,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminUiStore } from '../store/admin-ui.store';
import { useAdminSessionStore } from '../store/session.store';
import { cn } from '../lib/utils';

const links = [
  [adminCopy.navigation.dashboard, '/admin/dashboard', BarChart3],
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
  const clear = useAdminSessionStore((state) => state.clear);
  const open = useAdminUiStore((state) => state.navigationOpen);
  const setOpen = useAdminUiStore((state) => state.setNavigationOpen);
  const isLogin = pathname === '/admin/login' || pathname === '/';
  const segments = pathname.split('/').filter(Boolean).slice(1);

  if (isLogin) return <>{children}</>;

  function logout() {
    clear();
    router.push('/admin/login');
  }

  const navigation = (
    <>
      <Link
        href="/admin/dashboard"
        className="flex items-center gap-3 px-3 py-2"
        onClick={() => setOpen(false)}
      >
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-lg font-bold text-white">
          {appBrand.logoInitial}
        </span>
        <span>
          <span className="block font-serif text-xl font-semibold text-primary">
            {appBrand.name}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Operations
          </span>
        </span>
      </Link>
      <nav className="mt-7 space-y-1">
        {links.map(([label, href, Icon]) => {
          const active =
            pathname === href ||
            (href !== '/admin/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                active
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r bg-white p-5 md:block">
        {navigation}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-[280px] bg-white p-5 shadow-2xl">
            <button
              className="absolute right-4 top-4 rounded-lg p-2 hover:bg-muted"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {navigation}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur md:px-7">
          <button
            className="rounded-lg border p-2 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
            <span>Admin</span>
            {segments.map((segment) => (
              <span
                key={segment}
                className="flex items-center gap-1 capitalize"
              >
                <ChevronRight className="h-3 w-3" />
                {segment.replaceAll('-', ' ')}
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
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
        </header>
        {children}
      </div>
    </div>
  );
}
