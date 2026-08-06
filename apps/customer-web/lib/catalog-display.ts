import type { OrderingOfferingCode } from '@aranyam/shared-types';

export const offeringDisplay: Record<OrderingOfferingCode, { href: string }> = {
  MEAL_BOX: { href: '/packages/meal-boxes' },
  PACKAGES: { href: '/packages' },
  // The builder needs a selected package version, so establish that context
  // in the catalog before entering the builder.
  CUSTOM_MENU: { href: '/packages?type=CUSTOM_PACKAGE' },
};

export const catalogCopy = {
  trust: [
    ['Minimum order', 'Shown per package'],
    ['Advance booking', 'Configured from operations'],
    ['Clear pricing', 'No hidden additions'],
    ['Fresh preparation', 'Prepared for your event'],
  ],
  packageBenefits: [
    ['Expertly curated menus', 'Balanced choices for groups'],
    ['On-time delivery', 'Planned around your serving time'],
    ['Transparent pricing', 'Review the complete quote before payment'],
    ['Hygienic preparation', 'Prepared and packed with care'],
  ],
} as const;
