'use client';

import type { PackageConfiguration } from '@aranyam/shared-types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatePanel } from '../../../components/ui/state-panel';
import { apiRequest } from '../../../lib/api';

export default function LegacyPackageDetailsRoute() {
  const { packageId } = useParams<{ packageId: string }>();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ id: string }>(`/packages/${packageId}/active-version`)
      .then((activeVersion) =>
        apiRequest<PackageConfiguration>(
          `/package-versions/${activeVersion.id}/configuration`,
        ),
      )
      .then((configuration) => {
        const catalog =
          configuration.packageType === 'MEAL_BOX'
            ? '/packages/meal-boxes'
            : '/packages';
        router.replace(`${catalog}?details=${encodeURIComponent(packageId)}`);
      })
      .catch((reason) => setError((reason as Error).message));
  }, [packageId, router]);

  if (error) {
    return (
      <main className="page-shell">
        <StatePanel
          tone="danger"
          title="Package is unavailable"
          description={error}
          actionHref="/packages"
          actionLabel="Browse available packages"
        />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/15 border-t-primary" />
        <h1 className="mt-5 font-serif text-2xl font-bold">
          Opening package details…
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Taking you back to the catalog.
        </p>
      </div>
    </main>
  );
}
