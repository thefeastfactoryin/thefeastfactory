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
  quantity?: number;
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
  const [quoteState, setQuoteState] = useState<{
    key: string;
    quote: PackageSelectionPrice;
  }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const selectionKey = useMemo(
    () =>
      selectedItems
        .map(
          (item) =>
            `${item.categoryId}:${item.menuItemId}:${item.replacedMenuItemId ?? ''}:${item.role ?? ''}:${item.quantity ?? ''}`,
        )
        .sort()
        .join('|'),
    [selectedItems],
  );
  const requestKey = `${packageVersionId ?? ''}:${guestCount}:${selectionKey}`;

  useEffect(() => {
    if (!enabled || !packageVersionId || guestCount < 1) {
      setQuoteState(undefined);
      setError('');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const next = await apiRequest<PackageSelectionPrice>(
          `/package-versions/${packageVersionId}/preview-quote`,
          {
            method: 'POST',
            signal: controller.signal,
            body: JSON.stringify({ guestCount, selectedItems }),
          },
        );
        setQuoteState({ key: requestKey, quote: next });
        setError('');
      } catch (reason) {
        if (!controller.signal.aborted) {
          setQuoteState(undefined);
          setError((reason as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, packageVersionId, guestCount, requestKey, selectedItems]);

  return {
    quote: quoteState?.key === requestKey ? quoteState.quote : undefined,
    error,
    loading,
  };
}
