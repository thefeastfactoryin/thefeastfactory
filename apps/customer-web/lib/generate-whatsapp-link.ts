import { businessInfo } from '@aranyam/shared-types';

export const whatsappMessages = {
  default: 'Hi, I’m planning an event. Can you help me with menu options?',
  packages:
    'Hi, I’m interested in a package. Can you suggest what works best?',
  cart: 'Hi, I need help finalizing my order.',
  build: 'Hi, I have preferences for a custom menu. Can you help me build it?',
  recommendation: 'Hi, I’d like a menu recommendation for my event.',
  callback: 'Hi, I’d like to request a call back for my event.',
} as const;

export type WhatsAppMessageKey = keyof typeof whatsappMessages;

export function getSupportPhone(supportPhone?: string | null) {
  return (supportPhone ?? businessInfo.supportPhone).trim();
}

export function generateWhatsAppLink(
  message: string = whatsappMessages.default,
  supportPhone?: string | null,
) {
  const phoneNumber = getSupportPhone(supportPhone).replace(/\D/g, '');
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}
