import { Suspense } from 'react';
import { PackageGridPage } from '../../../components/catalog/package-grid-page';

export default function MealBoxesPage() {
  return (
    <Suspense fallback={<div className="page-shell h-96 animate-pulse rounded-2xl bg-white/60" />}>
      <PackageGridPage type="MEAL_BOX" title="Meal Boxes" description="Complete individual meals, packed and ready to serve." />
    </Suspense>
  );
}
