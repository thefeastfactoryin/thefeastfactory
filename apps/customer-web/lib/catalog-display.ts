import type {
  OrderingOfferingCode,
} from '@aranyam/shared-types';

export const orderByKgImage = '/order-by-kg-bulk.png';

export const offeringDisplay: Record<
  OrderingOfferingCode,
  { href: string }
> = {
  MEAL_BOX: { href: '/packages/meal-boxes' },
  PACKAGES: { href: '/packages' },
  ORDER_BY_KG: { href: '/order-by-kg' },
  CUSTOM_MENU: { href: '/packages/build' },
};

export const catalogCopy = {
  trust: [
    ['Clear pricing', 'Transparent rates for packages and dishes'],
    ['Flexible menus', 'Choose packages, meal boxes or your own menu'],
    ['Planned delivery', 'Match the delivery date and timing to your event'],
    ['Helpful support', 'Get guidance before you place your order'],
  ],
  packageBenefits: [
    ['Expertly curated menus', 'Balanced choices for groups'],
    ['On-time delivery', 'Planned around your serving time'],
    ['Transparent pricing', 'Review the complete quote before payment'],
    ['Hygienic preparation', 'Prepared and packed with care'],
  ],
} as const;
