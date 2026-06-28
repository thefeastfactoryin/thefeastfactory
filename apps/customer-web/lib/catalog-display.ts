import type { OrderingOfferingCode, PackageType } from '@aranyam/shared-types';

export const offeringDisplay: Record<OrderingOfferingCode, { href: string; image: string }> = {
  MEAL_BOX: { href: '/packages/meal-boxes', image: '/order-mealbox.png' },
  PACKAGES: { href: '/packages', image: '/order-occasion.png' },
  CUSTOM_MENU: { href: '/menu/visual-builder', image: '/order-build.png' },
};

const namedPackageImages: Record<string, string> = {
  'Pooja Package': '/pkg-puja.png',
  'Farm House Celebration': '/pkg-farmhouse.png',
  'Corporate Gathering': '/pkg-corporate.png',
  'Custom Menu': '/order-build.png',
};

export function packageImage(name: string, type: PackageType) {
  if (namedPackageImages[name]) return namedPackageImages[name];
  if (type === 'MEAL_BOX') {
    if (/\b3\b/.test(name)) return '/tray-3.png';
    if (/\b8\b/.test(name)) return '/tray-8.png';
    return '/tray-5.png';
  }
  return type === 'CUSTOM_PACKAGE' ? '/order-build.png' : '/pkg-community.png';
}

export const catalogCopy = {
  trust: [
    ['Minimum order', 'Shown per package'],
    ['Advance booking', 'At least 48 hours'],
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
