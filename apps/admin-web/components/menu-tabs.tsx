'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/utils';

const tabs = [
  { href: '/admin/menu/items', label: 'Items' },
  { href: '/admin/menu/categories', label: 'Categories' },
  { href: '/admin/menu/import', label: 'Import' },
];

export function MenuTabs() {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Menu management">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            'admin-tab',
            pathname === tab.href && 'admin-tab-active',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
