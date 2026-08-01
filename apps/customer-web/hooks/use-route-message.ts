'use client';

import { usePathname } from 'next/navigation';
import { whatsappMessages } from '../lib/generate-whatsapp-link';

export function useRouteMessage() {
  const pathname = usePathname();

  if (pathname === '/cart') return whatsappMessages.cart;
  if (pathname === '/packages/build' || pathname === '/build-your-own') {
    return whatsappMessages.build;
  }
  if (pathname === '/packages' || pathname === '/menu') {
    return whatsappMessages.packages;
  }
  return whatsappMessages.default;
}
