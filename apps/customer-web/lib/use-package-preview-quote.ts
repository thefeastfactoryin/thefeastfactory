'use client';

import type {
  PackageSelectionPrice,
  SelectedItemRole,
} from '@aranyam/shared-types';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';

type PreviewItem = {
  categoryId: string;
  menuItemId: string;
  replacedMenuItemId?: string | null;
  role?: SelectedItemRole;
};

export function usePackagePreviewQuote({
  packageVersionId,
  guestCount,
  selectedItems,
  enabled = true,
}: {
  packageVersionId?: string;
  guestCount: number;
  selectedItems: PreviewItem[];
  enabled?: boolean;
}) {
  const [quote, setQuote] = useState<PackageSelectionPrice>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const selectionKey = useMemo(
    () =>
      selectedItems
        .map(
          (item) =>
            `${item.categoryId}:${item.menuItemId}:${item.replacedMenuItemId ?? ''}:${item.role ?? ''}`,
        )
        .sort()
        .join('|'),
    [selectedItems],
  );

  useEffect(() => {
    if (!enabled || !packageVersionId || guestCount < 1) {
      setQuote(undefined);
      setError('');
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const next = await apiRequest<PackageSelectionPrice>(
          `/package-versions/${packageVersionId}/preview-quote`,
          {
            method: 'POST',
            body: JSON.stringify({ guestCount, selectedItems }),
          },
        );
        setQuote(next);
        setError('');
      } catch (reason) {
        setQuote(undefined);
        setError((reason as Error).message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [enabled, packageVersionId, guestCount, selectionKey, selectedItems]);

  return { quote, error, loading };
}
