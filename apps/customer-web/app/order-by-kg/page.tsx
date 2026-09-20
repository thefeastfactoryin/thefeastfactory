import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KgOrderBuilder } from '../../components/catalog/kg-order-builder';

export const metadata: Metadata = {
  title: 'Order by KG | The Feast Factory',
  description:
    'Choose individual dishes and order by weight with clear pricing per kg.',
};

export default function OrderByKgPage() {
  return (
    <Suspense fallback={<main className="page-shell">Loading dishes…</main>}>
      <KgOrderBuilder />
    </Suspense>
  );
}
