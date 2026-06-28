import type { CartSummary, PackageType, SelectedItemRole } from '@aranyam/shared-types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartPackage = {
  packageId: string;
  packageVersionId: string;
  packageName: string;
  packageType?: PackageType;
  isCustom: boolean;
  basePricePerPlate: string;
  minGuestCount: number;
  maxGuestCount?: number | null;
};

export type CartEvent = {
  addressId?: string;
  eventName?: string;
  eventDate?: string;
  eventTimeStart?: string;
  addressLabel?: string;
};

export type SelectedItem = {
  categoryId: string;
  categoryName: string;
  menuItemId: string;
  menuItemName: string;
  replacedMenuItemId?: string | null;
  replacedMenuItemName?: string | null;
  role?: SelectedItemRole;
  itemPrice: string;
  includedValue?: string;
  adjustmentAmount: string;
  isVeg: boolean;
};

type OrderBuilderState = {
  package?: CartPackage;
  event?: CartEvent;
  dbCartId?: string;
  pendingOrderId?: string;
  guestCount: number;
  selectedItems: SelectedItem[];
  setPackage: (pkg: CartPackage) => void;
  setEvent: (event: CartEvent) => void;
  setDbCartId: (cartId?: string) => void;
  setPendingOrderId: (orderId?: string) => void;
  setGuestCount: (guestCount: number) => void;
  toggleItem: (item: SelectedItem, maxSelections: number) => boolean;
  toggleSwap: (item: SelectedItem) => boolean;
  removeItem: (menuItemId: string) => void;
  removeSwap: (replacedMenuItemId: string) => void;
  clearSelections: () => void;
  reset: () => void;
  hydrateFromCart: (cart: CartSummary) => void;
};

export const useOrderBuilderStore = create<OrderBuilderState>()(
  persist(
    (set, get) => ({
      guestCount: 10,
      selectedItems: [],
      setPackage: (pkg) =>
        set((state) => {
          if (state.package?.packageVersionId === pkg.packageVersionId)
            return { package: pkg };
          return {
            package: pkg,
            event: undefined,
            dbCartId: undefined,
            guestCount: pkg.minGuestCount,
            selectedItems: [],
          };
        }),
      setEvent: (event) => set({ event }),
      setDbCartId: (cartId) => set({ dbCartId: cartId }),
      setPendingOrderId: (orderId) => set({ pendingOrderId: orderId }),
      setGuestCount: (guestCount) => set({ guestCount }),
      toggleItem: (item, maxSelections) => {
        const state = get();
        const exists = state.selectedItems.some(
          (selected) => selected.menuItemId === item.menuItemId,
        );
        if (exists) {
          set({
            selectedItems: state.selectedItems.filter(
              (selected) => selected.menuItemId !== item.menuItemId,
            ),
          });
          return true;
        }

        const categoryCount = state.selectedItems.filter(
          (selected) => selected.categoryId === item.categoryId,
        ).length;
        if (!state.package?.isCustom && categoryCount >= maxSelections)
          return false;
        set({ selectedItems: [...state.selectedItems, item] });
        return true;
      },
      toggleSwap: (item) => {
        if (!item.replacedMenuItemId) return false;
        const state = get();
        const existingForTarget = state.selectedItems.find(
          (selected) =>
            selected.replacedMenuItemId === item.replacedMenuItemId,
        );
        if (existingForTarget?.menuItemId === item.menuItemId) {
          set({
            selectedItems: state.selectedItems.filter(
              (selected) =>
                selected.replacedMenuItemId !== item.replacedMenuItemId,
            ),
          });
          return true;
        }
        set({
          selectedItems: [
            ...state.selectedItems.filter(
              (selected) =>
                selected.replacedMenuItemId !== item.replacedMenuItemId,
            ),
            item,
          ],
        });
        return true;
      },
      removeItem: (menuItemId) =>
        set((state) => ({
          selectedItems: state.selectedItems.filter(
            (selected) => selected.menuItemId !== menuItemId,
          ),
        })),
      removeSwap: (replacedMenuItemId) =>
        set((state) => ({
          selectedItems: state.selectedItems.filter(
            (selected) =>
              selected.replacedMenuItemId !== replacedMenuItemId,
          ),
        })),
      clearSelections: () => set({ selectedItems: [] }),
      hydrateFromCart: (cart) => set({
        dbCartId: cart.id,
        pendingOrderId: cart.pendingOrderId ?? undefined,
        package: {
          packageId: cart.package.id,
          packageVersionId: cart.packageVersionId,
          packageName: cart.package.name,
          packageType: cart.package.type,
          isCustom: cart.package.type === 'CUSTOM_PACKAGE',
          basePricePerPlate: cart.package.basePricePerPlate,
          minGuestCount: cart.package.minGuestCount,
          maxGuestCount: cart.package.maxGuestCount,
        },
        guestCount: cart.event?.guestCount ?? cart.package.minGuestCount,
        event: cart.event ? {
          addressId: cart.event.address?.id,
          eventName: cart.event.eventName ?? undefined,
          eventDate: cart.event.eventDate,
          eventTimeStart: cart.event.eventTimeStart ?? undefined,
          addressLabel: cart.event.address?.label || cart.event.address?.addressLine1 || '',
        } : undefined,
        selectedItems: cart.items.map((item) => ({
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          replacedMenuItemId: item.replacedMenuItemId,
          replacedMenuItemName: item.replacedMenuItemName,
          role: item.role,
          itemPrice: '0.00',
          adjustmentAmount: '0.00',
          isVeg: item.isVeg,
        })),
      }),
      reset: () =>
        set({
          package: undefined,
          event: undefined,
          dbCartId: undefined,
          pendingOrderId: undefined,
          guestCount: 10,
          selectedItems: [],
        }),
    }),
    {
      name: 'aranyam-order-cart',
      partialize: ({ package: pkg, event, dbCartId, pendingOrderId, guestCount, selectedItems }) => ({
        package: pkg,
        event,
        dbCartId,
        pendingOrderId,
        guestCount,
        selectedItems,
      }),
    },
  ),
);
