import type { PackageSummary } from '@aranyam/shared-types';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export default async function VisualBuilderPage() {
  let destination = '/packages';

  try {
    const response = await fetch(`${apiBaseUrl}/packages`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const packages = (await response.json()) as PackageSummary[];
      const customPackage = packages.find(
        (item) => item.type === 'CUSTOM_PACKAGE' && item.activeVersion,
      );
      if (customPackage?.activeVersion) {
        destination = `/packages/build?packageVersionId=${customPackage.activeVersion.id}`;
      }
    }
  } catch {
    // Fall back to the package catalog when the API is unavailable.
  }

  redirect(destination);
}
