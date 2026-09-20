import { formatCurrency } from './format';

type CalculationItem = {
  role?: string | null;
  itemPrice?: string | number | null;
  adjustmentAmount?: string | number | null;
  totalAdjustmentAmount?: string | number | null;
  quantity?: number | null;
  weightGrams?: number | null;
  pricePerKg?: string | null;
};

export function formatMenuCalculation({
  basePrice,
  guestCount,
  unitLabel,
  items,
}: {
  basePrice: string | number | null;
  guestCount: number | null;
  unitLabel: 'box' | 'guest';
  items: CalculationItem[];
}) {
  if (items.some((item) => item.weightGrams != null)) {
    return items.filter((item) => item.weightGrams != null).map((item) =>
      `${formatCurrency(item.pricePerKg ?? item.itemPrice ?? 0)} × ${item.weightGrams! / 1000} kg`
    ).join(' + ');
  }
  const units = `${guestCount} ${
    guestCount === 1
      ? unitLabel
      : unitLabel === 'box'
        ? 'boxes'
        : 'guests'
  }`;
  const terms: string[] = [];

  if (Number(basePrice) > 0) {
    terms.push(`${formatCurrency(basePrice)} × ${units}`);
  }

  items.forEach((item) => {
    const adjustment = Number(item.adjustmentAmount ?? item.itemPrice ?? 0);
    const totalAdjustment = Number(
      item.totalAdjustmentAmount ??
        (item.role === 'EXTRA'
          ? adjustment * (item.quantity ?? guestCount ?? 0)
          : adjustment),
    );
    if (totalAdjustment <= 0) return;

    if (item.role === 'EXTRA') {
      const quantity = item.quantity ?? guestCount;
      const portions = `${quantity} ${
        quantity === 1 ? 'portion' : 'portions'
      }`;
      terms.push(
        `${formatCurrency(item.itemPrice ?? adjustment)} × ${portions}`,
      );
      return;
    }

    terms.push(`${formatCurrency(adjustment)} × ${units}`);
  });

  return terms.length ? terms.join(' + ') : formatCurrency(0);
}
