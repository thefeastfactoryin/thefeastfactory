import { Suspense } from 'react';
import { PackageGridPage } from '../../components/catalog/package-grid-page';

export default function PackagesPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell h-96 animate-pulse rounded-2xl bg-white/60" />
      }
    >
      <PackageGridPage
        type="PACKAGES"
        title="Occasion Packages"
        description="Curated catering menus for family celebrations, gatherings, and events."
      />
    </Suspense>
  );
}
