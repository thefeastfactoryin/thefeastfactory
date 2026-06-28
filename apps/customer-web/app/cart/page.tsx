'use client';

import { CalendarDays, MapPin, ShoppingBag, Users } from 'lucide-react';
import type { CartSummary, OrderSummary, PackageSelectionPrice } from '@aranyam/shared-types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { useOrderBuilderStore } from '../../store/order-builder.store';
import { useSessionStore } from '../../store/session.store';
import { RetryPaymentButton } from '../../components/retry-payment-button';

export default function CartPage() {
  const session = useSessionStore((state) => state.session);
  const hydrate = useOrderBuilderStore((state) => state.hydrateFromCart);
  const [cart, setCart] = useState<CartSummary>();
  const [quote, setQuote] = useState<PackageSelectionPrice>();
  const [pendingOrder, setPendingOrder] = useState<OrderSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session) return;
    apiRequest<CartSummary | null>('/cart', {}, session.accessToken).then(async (value) => {
      if (!value) return;
      setCart(value); hydrate(value);
      if (value.pendingOrderId) {
        setPendingOrder(await apiRequest<OrderSummary>(`/orders/${value.pendingOrderId}`, {}, session.accessToken));
      } else if (value.event) {
        setQuote(await apiRequest<PackageSelectionPrice>('/cart/quote', { method: 'POST' }, session.accessToken));
      }
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [session, hydrate]);
  if (!session) return <AuthRequiredPanel title="Sign in to resume your cart" description="Your active server cart is linked to your mobile number." returnHref="/cart" />;
  if (loading) return <main className="page-shell"><div className="h-72 animate-pulse rounded-xl bg-white/60" /></main>;
  if (error) return <main className="page-shell"><StatePanel tone="danger" title="Cart could not load" description={error} actionHref="/cart" actionLabel="Retry" /></main>;
  if (!cart) return <main className="page-shell"><StatePanel icon={ShoppingBag} title="Your cart is empty" description="Choose a meal box or package to begin." actionHref="/packages" actionLabel="Browse products" /></main>;
  const editHref = cart.package.type === 'CUSTOM_PACKAGE' ? '/menu/visual-builder' : '/menu/select';
  const ready = Boolean(cart.event?.address && cart.event.eventDate && cart.event.eventTimeStart);
  return <main className="page-shell pb-28"><p className="eyebrow">Saved cart</p><h1 className="mt-3 font-serif text-5xl font-semibold">Review your order.</h1>{pendingOrder && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Payment is pending.</strong> Your package and order are safely reserved. Retry below without creating another order.</div>}<div className="mt-8 grid gap-7 lg:grid-cols-[1fr_360px]"><section className="surface-card overflow-hidden"><div className="border-b p-6"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="font-serif text-3xl font-semibold">{cart.package.name}</h2><p className="mt-1 text-sm text-muted-foreground">₹{cart.package.basePricePerPlate} per person</p></div>{!pendingOrder && <Button asChild variant="outline"><Link href={editHref}>Edit package or menu</Link></Button>}</div></div><div className="grid gap-4 border-b p-6 sm:grid-cols-3"><Info icon={CalendarDays} label="Event" value={cart.event ? `${cart.event.eventName || cart.package.name} · ${cart.event.eventDate} ${cart.event.eventTimeStart || ''}` : 'Details needed'} /><Info icon={Users} label="Guests" value={cart.event ? String(cart.event.guestCount) : 'Not set'} /><Info icon={MapPin} label="Venue" value={cart.event?.address ? `${cart.event.address.label || cart.event.address.addressLine1}, ${cart.event.address.city}` : 'Not set'} /></div><div className="divide-y">{cart.items.length ? cart.items.map((item) => <div key={item.id} className="flex justify-between px-6 py-3 text-sm"><div><strong>{item.menuItemName}</strong><p className="text-xs text-muted-foreground">{item.categoryName} · {item.isVeg ? 'Veg' : 'Non-Veg'}</p></div><span>{item.role.replaceAll('_',' ')}</span></div>) : <p className="p-6 text-sm text-muted-foreground">The package’s included menu will be applied at checkout.</p>}</div></section><aside className="surface-card h-fit p-6 lg:sticky lg:top-24"><p className="eyebrow">{pendingOrder ? 'Payment' : 'Estimate'}</p>{pendingOrder ? <><div className="mt-5 flex justify-between border-b pb-4 text-xl font-bold"><span>Total</span><span>₹{pendingOrder.totalAmount}</span></div><div className="mt-5"><RetryPaymentButton order={pendingOrder} /></div><Button asChild variant="outline" className="mt-3 w-full"><Link href={`/orders/${pendingOrder.id}`}>View saved order</Link></Button></> : <>{quote ? <div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span>Per person</span><span>₹{quote.finalPerPlatePrice}</span></div><div className="flex justify-between"><span>Delivery</span><span>₹{quote.deliveryFee}</span></div><div className="flex justify-between border-t pt-4 text-xl font-bold"><span>Total</span><span>₹{quote.totalAmount}</span></div></div> : <p className="mt-4 text-sm text-muted-foreground">Complete event details to calculate the final quote.</p>}<Button asChild className="mt-6 w-full" disabled={!ready}><Link href={ready ? '/checkout' : editHref}>{ready ? 'Review & Pay' : 'Complete event details'}</Link></Button></>}</aside></div></main>;
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value}</p></div></div>; }
