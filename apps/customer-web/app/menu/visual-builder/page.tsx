import type { PackageConfiguration, PackageSummary } from '@aranyam/shared-types';
import { Suspense } from 'react';
import {
  VisualBuilderClient,
  type VisualBuilderInitialPackage,
} from './visual-builder-client';

export const dynamic = 'force-dynamic';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function apiGet<T>(path: string): Promise<T | undefined> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      cache: 'no-store',
    });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

async function loadInitialCustomMenu() {
  const packages = await apiGet<PackageSummary[]>('/packages');
  const customPackage = packages?.find(
    (item) => item.type === 'CUSTOM_PACKAGE' && item.activeVersion,
  );
  if (!customPackage?.activeVersion) return {};

  const initialPackage: VisualBuilderInitialPackage = {
    packageId: customPackage.id,
    packageVersionId: customPackage.activeVersion.id,
    packageName: customPackage.name,
    packageType: customPackage.type,
    isCustom: customPackage.isCustom,
    basePricePerPlate: customPackage.activeVersion.basePricePerPlate,
    minGuestCount: customPackage.activeVersion.minGuestCount,
    maxGuestCount: customPackage.activeVersion.maxGuestCount,
  };
  const initialConfig = await apiGet<PackageConfiguration>(
    `/package-versions/${customPackage.activeVersion.id}/configuration`,
  );

  return { initialPackage, initialConfig };
}

export default async function VisualBuilderPage() {
  const { initialPackage, initialConfig } = await loadInitialCustomMenu();

  return (
    <Suspense
      fallback={
        <main className="page-shell">
          <div className="h-96 animate-pulse rounded-xl bg-white/60" />
        </main>
      }
    >
      <VisualBuilderClient
        initialPackage={initialPackage}
        initialConfig={initialConfig}
      />
    </Suspense>
  );
}
