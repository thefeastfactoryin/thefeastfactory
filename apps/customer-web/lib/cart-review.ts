import type { CartSummary } from '@aranyam/shared-types';
import type { CartEvent, CartPackage } from '../store/order-builder.store';
import { apiRequest } from './api';

export async function saveCartBeforeReview({
  accessToken,
  pkg,
  event,
  guestCount,
}: {
  accessToken: string;
  pkg?: CartPackage;
  event?: CartEvent;
  guestCount: number;
}) {
  if (!pkg) throw new Error('Choose a package before checkout.');
  if (!event?.addressId) throw new Error('Choose a venue before checkout.');
  if (!event.eventDate) throw new Error('Choose an event date before checkout.');
  if (!event.eventTimeStart) throw new Error('Choose an event time before checkout.');
  if (guestCount < pkg.minGuestCount || (pkg.maxGuestCount && guestCount > pkg.maxGuestCount)) {
    throw new Error(`Guest count must be between ${pkg.minGuestCount} and ${pkg.maxGuestCount ?? 'the package maximum'}.`);
  }
  return apiRequest<CartSummary>('/cart', {
    method: 'PUT',
    body: JSON.stringify({
      packageVersionId: pkg.packageVersionId,
      addressId: event.addressId,
      eventName: event.eventName?.trim() || pkg.packageName,
      eventDate: event.eventDate,
      eventTimeStart: event.eventTimeStart,
      guestCount,
    }),
  }, accessToken);
}
