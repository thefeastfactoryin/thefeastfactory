import type { PackageConfiguration } from '@aranyam/shared-types';
import { redirect } from 'next/navigation';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export default async function LegacyPackageDetailsRoute({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params;
  let catalog = '/packages';
  try {
    const versionResponse = await fetch(
      `${apiBaseUrl}/packages/${encodeURIComponent(packageId)}/active-version`,
      { cache: 'no-store' },
    );
    if (versionResponse.ok) {
      const version = (await versionResponse.json()) as { id: string };
      const configResponse = await fetch(
        `${apiBaseUrl}/package-versions/${version.id}/configuration`,
        { cache: 'no-store' },
      );
      if (configResponse.ok) {
        const config = (await configResponse.json()) as PackageConfiguration;
        if (config.packageType === 'MEAL_BOX') catalog = '/packages/meal-boxes';
      }
    }
  } catch {
    // The catalog will render its unavailable-package state for this id.
  }
  redirect(`${catalog}?details=${encodeURIComponent(packageId)}`);
}
