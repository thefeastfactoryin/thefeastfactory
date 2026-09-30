import type {
  Cart,
  CartItem,
  DeliveryServiceType,
  PackageType,
  SelectedItemRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';

export type CheckoutItemSnapshot = {
  categoryId: string;
  menuItemId: string;
  replacedMenuItemId: string | null;
  role: SelectedItemRole;
  quantity: number;
  weightGrams: number | null;
  pricePerKg: string | null;
  lineTotal: string | null;
  menuItemName: string;
  categoryName: string;
  replacedMenuItemName: string | null;
  isVeg: boolean;
  itemPrice: string;
  includedValue: string;
  adjustmentAmount: string;
};

export type CheckoutCartSnapshot = {
  cartId: string;
  cartFingerprint: string;
  addressId: string;
  regionId: string;
  eventName: string | null;
  eventDate: string;
  eventTimeStart: string;
  specialNotes: string | null;
  contactNumber: string;
  packageType: PackageType;
  packageName: string;
  packageImageUrl: string | null;
  packageVersionNo: number;
  guestCount: number | null;
  basePerPlatePrice: string | null;
  totalCustomizationCharges: string | null;
  finalPerPlatePrice: string | null;
  totalAmount: string;
  distanceKm: string | null;
  deliveryFee: string;
  deliveryServiceType: DeliveryServiceType;
  helperCount: number;
  cutleryIncludedCount: number;
  cutleryExtraCount: number;
  cutleryUnitPrice: string;
  cutleryTotal: string;
  selectedItems: CheckoutItemSnapshot[];
};

export type CheckoutSnapshot = {
  carts: CheckoutCartSnapshot[];
  totalAmount: string;
};

export function cartFingerprint(cart: Cart & { items: CartItem[] }) {
  const value = {
    packageVersionId: cart.packageVersionId,
    addressId: cart.addressId,
    eventName: cart.eventName,
    eventDate: cart.eventDate?.toISOString(),
    eventTimeStart: cart.eventTimeStart?.toISOString(),
    guestCount: cart.guestCount,
    deliveryServiceType: cart.deliveryServiceType,
    helperCount: cart.helperCount,
    cutleryExtraCount: cart.cutleryExtraCount,
    contactNumber: cart.contactNumber,
    specialNotes: cart.specialNotes,
    items: cart.items
      .map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        menuItemId: item.menuItemId,
        replacedMenuItemId: item.replacedMenuItemId,
        role: item.role,
        quantity: item.quantity,
        weightGrams: item.weightGrams,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
