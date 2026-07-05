'use client';

import { LegalPage } from '../../components/legal-page/legal-page';
import { usePublicSettings } from '../../components/public-settings-provider';

export default function CancellationPolicyPage() {
  const settings = usePublicSettings();
  return (
    <LegalPage
      page={{
        title: 'Cancellation Policy',
        eyebrow: 'Policy',
        summary: 'Cancellation eligibility depends on order status, event date, kitchen preparation, and payment/refund state.',
        sections: [
          {
            title: 'Customer cancellations',
            body: 'Eligible orders can be cancelled before the order reaches final preparation or delivery stages. Contact support for assistance.',
          },
          {
            title: 'Refund handling',
            body: 'Refunds, when applicable, are processed through the original payment method and shown on the order detail page.',
          },
          {
            title: 'Need help?',
            body:
              [settings?.business.supportPhone, settings?.business.supportEmail]
                .filter(Boolean)
                .join(' or ') || 'Support contact details are being updated.',
          },
        ],
      }}
    />
  );
}
