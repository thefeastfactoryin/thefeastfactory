import { legalPages } from '@aranyam/shared-types';
import { LegalPage } from '../../components/legal-page/legal-page';

export default function CancellationPolicyPage() {
  return <LegalPage page={legalPages.cancellation} />;
}
