'use client';

import { LegalPage } from '../../components/legal-page/legal-page';
import { usePublicSettings } from '../../components/public-settings-provider';

export default function PrivacyPage() {
  const settings = usePublicSettings();
  return (
    <LegalPage
      page={{
        title: 'Privacy Policy',
        eyebrow: 'Legal',
        summary: 'This policy explains the customer information we collect to operate catering orders and support.',
        sections: [
          {
            title: 'Information collected',
            body: 'We collect mobile number, OTP verification records, profile details, addresses, event information, order selections, payments, and support interactions.',
          },
          {
            title: 'How it is used',
            body: 'Information is used to authenticate customers, price orders, coordinate delivery, generate receipts, provide support, and meet legal or tax obligations.',
          },
          {
            title: 'Support',
            body: settings?.business.supportEmail
              ? `For privacy questions, contact ${settings.business.supportEmail}.`
              : 'Privacy contact details are being updated.',
          },
        ],
      }}
    />
  );
}
