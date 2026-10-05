import {
  statusLabels,
  type BookingFulfilmentStatus,
  type OrderStatus,
} from '@aranyam/shared-types';
import { cn } from '../lib/utils';

export function StatusBadge({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const tone =
    value.includes('FAILED') || value === 'CANCELLED' || value === 'DECLINED'
      ? 'bg-red-50 text-red-700'
      : value.includes('PENDING') ||
          value.includes('PROCESSING') ||
          value === 'AWAITING_APPROVAL' ||
          value === 'UNPAID' ||
          value === 'PARTIALLY_PAID'
        ? 'bg-amber-50 text-amber-700'
        : value === 'PAID' ||
            value === 'DELIVERED' ||
            value === 'SUCCESS' ||
            value === 'COMPLETED'
          ? 'bg-emerald-50 text-emerald-700'
          : value === 'OUT_FOR_DELIVERY'
            ? 'bg-sky-50 text-sky-700'
            : 'bg-rose-50 text-rose-800';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        tone,
      )}
    >
      {label ?? value.replaceAll('_', ' ')}
    </span>
  );
}

export function OrderStatusBadge({ value }: { value: OrderStatus }) {
  return (
    <StatusBadge
      value={value}
      label={
        statusLabels.order[value as keyof typeof statusLabels.order] ??
        value.replaceAll('_', ' ')
      }
    />
  );
}

export function FulfilmentStatusBadge({
  value,
}: {
  value: BookingFulfilmentStatus;
}) {
  return (
    <StatusBadge
      value={value}
      label={statusLabels.fulfilment[value]}
    />
  );
}
