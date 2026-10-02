import { cn } from '../lib/utils';

export function StatusBadge({ value }: { value: string }) {
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
            value === 'CONFIRMED'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-rose-50 text-rose-800';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        tone,
      )}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}
