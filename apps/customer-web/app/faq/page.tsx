'use client';

import { LegalPage } from '../../components/legal-page/legal-page';
import { usePublicSettings } from '../../components/public-settings-provider';

export default function FaqPage() {
  const settings = usePublicSettings();
  return (
    <LegalPage
      page={{
        title: 'Help & FAQ',
        eyebrow: 'Support',
        summary: 'Answers to common questions about booking, payment, delivery, changes, and support.',
        sections: [
          {
            title: 'How early should I book?',
            body: settings
              ? `Please book at least ${settings.minBookingLeadHours} hours before your event unless the selected package shows a different rule.`
              : 'Loading the current booking policy…',
          },
          {
            title: 'Can I change my menu after booking?',
            body: 'Contact support as early as possible. Changes depend on kitchen readiness, ingredient availability, and the event date.',
          },
          {
            title: 'How do I get help with an order?',
            body:
              [settings?.business.supportPhone, settings?.business.supportEmail]
                .filter(Boolean)
                .join(' or ') || 'Contact details are being updated.',
          },
        ],
      }}
    />
  );
}
