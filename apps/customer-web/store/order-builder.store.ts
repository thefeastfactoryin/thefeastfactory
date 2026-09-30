import type {
  CartSummary,
  PackageType,
  SelectedItemRole,
} from '@aranyam/shared-types';
import { create } from 'zustand';

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
  quantity?: number;
  weightGrams?: number | null;
  isVeg: boolean;
};

type OrderBuilderState = {
  package?: CartPackage;
  dbCartId?: string;
  guestCount: number;
  selectedItems: SelectedItem[];
  setPackage: (pkg: CartPackage) => void;
  setDbCartId: (cartId?: string) => void;
  setGuestCount: (guestCount: number) => void;
  toggleItem: (item: SelectedItem, maxSelections: number) => boolean;
  setSwap: (item: SelectedItem) => boolean;
  updateItemQuantity: (menuItemId: string, quantity: number) => void;
  removeItem: (menuItemId: string) => void;
  removeSwap: (replacedMenuItemId: string) => void;
  reset: () => void;
  hydrateFromCart: (cart: CartSummary) => void;
};

export const useOrderBuilderStore = create<OrderBuilderState>()(
    (set, get) => ({
      guestCount: 0,
      selectedItems: [],
      setPackage: (pkg) =>
        set((state) => {
          if (state.package?.packageVersionId === pkg.packageVersionId)
            return { package: pkg };
          return {
            package: pkg,
            dbCartId: undefined,
            guestCount: pkg.minGuestCount,
            selectedItems: [],
          };
        }),
      setDbCartId: (cartId) => set({ dbCartId: cartId }),
      setGuestCount: (guestCount) => set({ guestCount }),
      toggleItem: (item, maxSelections) => {
        const state = get();
        const sameSelection = (selected: SelectedItem) =>
          selected.menuItemId === item.menuItemId &&
          selected.role === item.role &&
          (selected.replacedMenuItemId ?? null) ===
            (item.replacedMenuItemId ?? null);
        const exists = state.selectedItems.some(
          (selected) => sameSelection(selected),
        );
        if (exists) {
          set({
            selectedItems: state.selectedItems.filter(
              (selected) => !sameSelection(selected),
            ),
          });
          return true;
        }

        const categoryCount = state.selectedItems.filter(
          (selected) =>
            selected.categoryId === item.categoryId &&
            selected.role === item.role &&
            (selected.replacedMenuItemId ?? null) === null,
        ).length;
        if (!state.package?.isCustom && categoryCount >= maxSelections)
          return false;
        set({ selectedItems: [...state.selectedItems, item] });
        return true;
      },
      setSwap: (item) => {
        if (!item.replacedMenuItemId) return false;
        set((state) => ({
          selectedItems: [
            ...state.selectedItems.filter(
              (selected) =>
                selected.replacedMenuItemId !== item.replacedMenuItemId,
            ),
            item,
          ],
        }));
        return true;
      },
      updateItemQuantity: (menuItemId, quantity) =>
        set((state) => ({
          selectedItems: state.selectedItems.map((selected) =>
            selected.menuItemId === menuItemId &&
            selected.role === 'EXTRA' &&
            !selected.replacedMenuItemId
              ? { ...selected, quantity }
              : selected,
          ),
        })),
      removeItem: (menuItemId) =>
        set((state) => ({
          selectedItems: state.selectedItems.filter(
            (selected) =>
              !(
                selected.menuItemId === menuItemId &&
                selected.role === 'EXTRA' &&
                !selected.replacedMenuItemId
              ),
          ),
        })),
      removeSwap: (replacedMenuItemId) =>
        set((state) => ({
          selectedItems: state.selectedItems.filter(
            (selected) => selected.replacedMenuItemId !== replacedMenuItemId,
          ),
        })),
      hydrateFromCart: (cart) =>
        set({
          dbCartId: cart.id,
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
          guestCount:
            cart.event?.guestCount ??
            cart.guestCount ??
            cart.package.minGuestCount,
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
            quantity: item.quantity,
            weightGrams: item.weightGrams,
            isVeg: item.isVeg,
          })),
        }),
      reset: () =>
        set({
          package: undefined,
          dbCartId: undefined,
          guestCount: 0,
          selectedItems: [],
        }),
    }),
);
