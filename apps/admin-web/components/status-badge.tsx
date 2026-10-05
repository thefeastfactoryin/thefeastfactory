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
      ? 'border-red-200 bg-red-50 text-red-700 before:bg-red-500'
      : value.includes('PENDING') ||
          value.includes('PROCESSING') ||
          value === 'AWAITING_APPROVAL' ||
          value === 'UNPAID' ||
          value === 'PARTIALLY_PAID'
        ? 'border-amber-200 bg-amber-50 text-amber-800 before:bg-amber-500'
        : value === 'PAID' ||
            value === 'DELIVERED' ||
            value === 'SUCCESS' ||
            value === 'COMPLETED'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 before:bg-emerald-500'
          : value === 'OUT_FOR_DELIVERY'
            ? 'border-sky-200 bg-sky-50 text-sky-800 before:bg-sky-500'
            : value === 'READY_FOR_DELIVERY'
              ? 'border-indigo-200 bg-indigo-50 text-indigo-800 before:bg-indigo-500'
              : value === 'PREPARING' || value === 'IN_PROGRESS'
                ? 'border-orange-200 bg-orange-50 text-orange-800 before:bg-orange-500'
                : value === 'NOT_STARTED'
                  ? 'border-slate-200 bg-slate-50 text-slate-700 before:bg-slate-400'
                  : 'border-primary/20 bg-primary/[0.06] text-primary before:bg-primary';
  return (
    <span
      className={cn(
        'inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none shadow-sm before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full',
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
  return <StatusBadge value={value} label={statusLabels.fulfilment[value]} />;
}
