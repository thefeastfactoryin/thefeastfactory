const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

export function formatCurrency(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return inr.format(Number.isFinite(amount) ? amount : 0);
}

export function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatCustomerBookingStatus(value: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Awaiting Confirmation',
    PENDING_PAYMENT: 'Awaiting Confirmation',
    AWAITING_APPROVAL: 'Awaiting Confirmation',
    NEEDS_REVIEW: 'Awaiting Confirmation',
    CONFIRMED: 'Confirmed',
    IN_PROGRESS: 'Confirmed',
    READY_FOR_DELIVERY: 'Confirmed',
    OUT_FOR_DELIVERY: 'Confirmed',
    DELIVERED: 'Completed',
    COMPLETED: 'Completed',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled',
  };
  return labels[value] ?? formatStatus(value);
}

const CATEGORY_LABELS: Record<string, string> = {
  Starters: 'Starters',
  'Indian Breads': 'Indian Breads',
  Curry: 'Curry',
  Curries: 'Curries',
  Biryani: 'Biryani',
  'Rice Items': 'Rice Items',
  Desserts: 'Desserts',
  Accompaniments: 'Accompaniments',
};

export function formatCategoryLabel(
  value: string,
  options?: { singular?: boolean },
) {
  const trimmed = value.trim();
  const label = CATEGORY_LABELS[trimmed] ?? trimmed;
  if (options?.singular) {
    if (label === 'Starters') return 'Starter';
    if (label === 'Indian Breads') return 'Indian Bread';
  }
  return label;
}
