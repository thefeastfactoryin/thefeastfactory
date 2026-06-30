import { Suspense } from 'react';
import { PackageGridPage } from '../../components/catalog/package-grid-page';

export default function PackagesPage() {
  return (
    <Suspense fallback={<div className="page-shell h-96 animate-pulse rounded-2xl bg-white/60" />}>
      <PackageGridPage type="PACKAGES" title="Catering Packages" description="Compare the essentials at a glance. Select a package to add your event details and review its complete menu." />
    </Suspense>
  );
}
