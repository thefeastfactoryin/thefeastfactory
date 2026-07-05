'use client';

import { LegalPage } from '../../components/legal-page/legal-page';
import { usePublicSettings } from '../../components/public-settings-provider';

export default function ContactPage() {
  const settings = usePublicSettings();
  const business = settings?.business;
  return (
    <LegalPage
      page={{
        title: 'Contact Us',
        eyebrow: 'We are here to help',
        summary:
          'For booking questions, order changes, payment help, or event-day coordination, contact our support team.',
        sections: [
          { title: 'Phone', body: business?.supportPhone || 'Contact details are being updated.' },
          { title: 'Email', body: business?.supportEmail || 'Contact details are being updated.' },
          { title: 'Office', body: business?.address || 'Service address is being updated.' },
        ],
      }}
    />
  );
}
