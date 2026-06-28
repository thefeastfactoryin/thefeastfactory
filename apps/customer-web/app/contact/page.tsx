import { legalPages } from '@aranyam/shared-types';
import { LegalPage } from '../../components/legal-page/legal-page';

export default function ContactPage() {
  return <LegalPage page={legalPages.contact} />;
}
