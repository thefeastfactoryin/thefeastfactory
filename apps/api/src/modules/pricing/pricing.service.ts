import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackageMenuItemRole,
  PackageType,
  Prisma,
  SelectedItemRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type SelectedItemInput = {
  categoryId: string;
  menuItemId: string;
  replacedMenuItemId?: string | null;
  role?: SelectedItemRole;
  quantity?: number;
};

type VersionForQuote = Prisma.PackageVersionGetPayload<{
  include: {
    package: true;
    packageMenuItems: {
      include: { menuItem: true; category: true };
    };
  };
}>;

type QuoteItem = {
  categoryId: string;
  categoryName: string;
  menuItemId: string;
  menuItemName: string;
  replacedMenuItemId?: string | null;
  replacedMenuItemName?: string | null;
  role: SelectedItemRole;
  isVeg: boolean;
  itemPrice: Prisma.Decimal;
  includedValue: Prisma.Decimal;
  adjustmentAmount: Prisma.Decimal;
  quantity: number;
  totalAdjustmentAmount: Prisma.Decimal;
};

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(
    packageVersionId: string,
    guestCount: number,
    selectedItems: SelectedItemInput[],
  ) {
    const version = await this.prisma.packageVersion.findFirst({
      where: {
        id: packageVersionId,
        isActive: true,
        publishedAt: { not: null },
        package: { isActive: true, deletedAt: null },
      },
      include: {
        package: true,
        packageMenuItems: {
          where: {
            isAvailable: true,
            menuItem: { isActive: true, deletedAt: null },
          },
          include: { menuItem: true, category: true },
          orderBy: [{ displayOrder: 'asc' }, { menuItem: { name: 'asc' } }],
        },
      },
    });
    if (!version) throw new NotFoundException('Package version not found');
    if (
      guestCount < version.minGuestCount ||
      (version.maxGuestCount && guestCount > version.maxGuestCount)
    ) {
      throw new BadRequestException('Guest count is outside package limits');
    }

    const items = await this.evaluate(version, selectedItems, guestCount);
    const customization = items.reduce(
      (sum, item) => sum.plus(item.adjustmentAmount),
      new Prisma.Decimal(0),
    );
    const finalPerPlate = version.basePricePerPlate.plus(customization);
    return {
      packageVersionId: version.id,
      packageName: version.package.name,
      packageVersionNo: version.versionNo,
      guestCount,
      basePerPlatePrice: version.basePricePerPlate,
      totalCustomizationCharges: customization,
      finalPerPlatePrice: finalPerPlate,
      totalAmount: finalPerPlate.mul(guestCount),
      items,
    };
  }

  private async evaluate(
    version: VersionForQuote,
    selectedItems: SelectedItemInput[],
    guestCount: number,
  ) {
    if (version.package.type === PackageType.CUSTOM_PACKAGE) {
      return this.customItems(version, selectedItems);
    }
    if (version.package.type === PackageType.MEAL_BOX) {
      return this.mealBoxItems(version, selectedItems);
    }
    return this.fixedPackageItems(version, selectedItems, guestCount);
  }

  private async customItems(
    version: VersionForQuote,
    selectedItems: SelectedItemInput[],
  ): Promise<QuoteItem[]> {
    const errors = this.duplicateErrors(selectedItems);
    if (!selectedItems.length) errors.push('Choose at least one menu item');

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: selectedItems.map((item) => item.menuItemId) },
        isActive: true,
        deletedAt: null,
      },
      include: { category: true },
    });
    const byId = new Map(menuItems.map((item) => [item.id, item]));
    const configuredIds = new Set(
      version.packageMenuItems.map((row) => row.menuItemId),
    );
    const items = selectedItems.flatMap((selection) => {
      const item = byId.get(selection.menuItemId);
      if (
        !item ||
        item.categoryId !== selection.categoryId ||
        (configuredIds.size > 0 && !configuredIds.has(selection.menuItemId))
      ) {
        errors.push(`Invalid menu item ${selection.menuItemId}`);
        return [];
      }
      return [
        {
          categoryId: item.categoryId,
          categoryName: item.category.name,
          menuItemId: item.id,
          menuItemName: item.name,
          role: SelectedItemRole.CUSTOM,
          isVeg: item.isVeg,
          itemPrice: item.generalPrice,
          includedValue: new Prisma.Decimal(0),
          adjustmentAmount: item.generalPrice,
          quantity: 1,
          totalAdjustmentAmount: item.generalPrice,
        },
      ];
    });

    this.throwIfErrors(errors, 'Invalid custom package selection');
    return items;
  }

  private async fixedPackageItems(
    version: VersionForQuote,
    selectedItems: SelectedItemInput[],
    guestCount: number,
  ): Promise<QuoteItem[]> {
    const errors = this.duplicateErrors(selectedItems);
    const extras = new Map(
      version.packageMenuItems
        .filter((row) => row.role === PackageMenuItemRole.EXTRA)
        .map((row) => [row.menuItemId, row]),
    );
    const includedRows = version.packageMenuItems.filter(
      (row) => row.role === PackageMenuItemRole.INCLUDED,
    );
    const includedById = new Map(
      includedRows.map((row) => [row.menuItemId, row]),
    );
    const swapSelections = selectedItems.filter(
      (selection) => selection.replacedMenuItemId,
    );
    const replacementIds = swapSelections.map((item) => item.menuItemId);
    const replacementRows = replacementIds.length
      ? await this.prisma.menuItem.findMany({
          where: {
            id: { in: replacementIds },
            isActive: true,
            deletedAt: null,
          },
        })
      : [];
    const replacementById = new Map(
      replacementRows.map((item) => [item.id, item] as const),
    );

    const extraItems = selectedItems
      .filter((selection) => !selection.replacedMenuItemId)
      .flatMap((selection) => {
        const row = extras.get(selection.menuItemId);
        if (!row || row.categoryId !== selection.categoryId) {
          errors.push(`Menu item ${selection.menuItemId} is not a valid extra`);
          return [];
        }
        const quantity = selection.quantity ?? guestCount;
        if (quantity < 1) {
          errors.push(`${row.menuItem.name} quantity must be at least 1`);
          return [];
        }
        const totalAdjustmentAmount = row.menuItem.generalPrice.mul(quantity);
        return [
          {
            categoryId: row.categoryId,
            categoryName: row.category.name,
            menuItemId: row.menuItemId,
            menuItemName: row.menuItem.name,
            role: SelectedItemRole.EXTRA,
            isVeg: row.menuItem.isVeg,
            itemPrice: row.menuItem.generalPrice,
            includedValue: new Prisma.Decimal(0),
            adjustmentAmount: totalAdjustmentAmount.div(guestCount),
            quantity,
            totalAdjustmentAmount,
          },
        ];
      });

    const swapItems = swapSelections.flatMap((selection) => {
      const included = includedById.get(selection.replacedMenuItemId!);
      const replacement = replacementById.get(selection.menuItemId);
      if (!included) {
        errors.push(
          `Replacement target ${selection.replacedMenuItemId} is not in this package`,
        );
        return [];
      }
      if (!included.isSwappable) {
        errors.push(`${included.menuItem.name} cannot be swapped`);
        return [];
      }
      if (!replacement) {
        errors.push(`Invalid replacement item ${selection.menuItemId}`);
        return [];
      }
      if (
        replacement.categoryId !== included.categoryId ||
        replacement.isVeg !== included.menuItem.isVeg
      ) {
        errors.push(
          `${replacement.name} is not eligible to replace ${included.menuItem.name}`,
        );
        return [];
      }
      const adjustmentAmount = Prisma.Decimal.max(
        replacement.generalPrice.minus(included.menuItem.generalPrice),
        0,
      );
      return [
        {
          categoryId: replacement.categoryId,
          categoryName: included.category.name,
          menuItemId: replacement.id,
          menuItemName: replacement.name,
          replacedMenuItemId: included.menuItemId,
          replacedMenuItemName: included.menuItem.name,
          role: SelectedItemRole.SWAP,
          isVeg: replacement.isVeg,
          itemPrice: replacement.generalPrice,
          includedValue: included.menuItem.generalPrice,
          adjustmentAmount,
          quantity: 1,
          totalAdjustmentAmount: adjustmentAmount,
        },
      ];
    });

    this.throwIfErrors(errors, 'Invalid fixed package selection');
    return [...extraItems, ...swapItems];
  }

  private async mealBoxItems(
    version: VersionForQuote,
    selectedItems: SelectedItemInput[],
  ): Promise<QuoteItem[]> {
    const errors = this.duplicateErrors(selectedItems);
    const includedRows = version.packageMenuItems.filter(
      (row) => row.role === PackageMenuItemRole.INCLUDED,
    );
    const includedById = new Map(
      includedRows.map((row) => [row.menuItemId, row]),
    );
    const swaps = new Map<string, SelectedItemInput>();
    for (const selection of selectedItems) {
      if (!selection.replacedMenuItemId) {
        errors.push('Meal boxes only support swaps of included items');
        continue;
      }
      swaps.set(selection.replacedMenuItemId, selection);
    }

    const replacementIds = [...swaps.values()].map((item) => item.menuItemId);
    const replacementRows = replacementIds.length
      ? await this.prisma.menuItem.findMany({
          where: {
            id: { in: replacementIds },
            isActive: true,
            deletedAt: null,
          },
        })
      : [];
    const replacementById = new Map(
      replacementRows.map((item) => [item.id, item] as const),
    );

    const items: QuoteItem[] = [];
    for (const included of includedRows) {
      const swap = swaps.get(included.menuItemId);
      if (!swap) {
        items.push({
          categoryId: included.categoryId,
          categoryName: included.category.name,
          menuItemId: included.menuItemId,
          menuItemName: included.menuItem.name,
          role: SelectedItemRole.INCLUDED,
          isVeg: included.menuItem.isVeg,
          itemPrice: included.menuItem.boxPrice,
          includedValue: included.menuItem.boxPrice,
          adjustmentAmount: new Prisma.Decimal(0),
          quantity: 1,
          totalAdjustmentAmount: new Prisma.Decimal(0),
        });
        continue;
      }

      const replacement = replacementById.get(swap.menuItemId);
      if (!included.isSwappable) {
        errors.push(`${included.menuItem.name} cannot be swapped`);
        continue;
      }
      if (!replacement) {
        errors.push(`Invalid replacement item ${swap.menuItemId}`);
        continue;
      }
      if (
        replacement.categoryId !== included.categoryId ||
        replacement.isVeg !== included.menuItem.isVeg
      ) {
        errors.push(
          `${replacement.name} is not eligible to replace ${included.menuItem.name}`,
        );
        continue;
      }
      const adjustmentAmount = Prisma.Decimal.max(
        replacement.boxPrice.minus(included.menuItem.boxPrice),
        0,
      );
      items.push({
        categoryId: replacement.categoryId,
        categoryName: included.category.name,
        menuItemId: replacement.id,
        menuItemName: replacement.name,
        replacedMenuItemId: included.menuItemId,
        replacedMenuItemName: included.menuItem.name,
        role: SelectedItemRole.SWAP,
        isVeg: replacement.isVeg,
        itemPrice: replacement.boxPrice,
        includedValue: included.menuItem.boxPrice,
        adjustmentAmount,
        quantity: 1,
        totalAdjustmentAmount: adjustmentAmount,
      });
    }

    for (const targetId of swaps.keys()) {
      if (!includedById.has(targetId)) {
        errors.push(`Replacement target ${targetId} is not in this meal box`);
      }
    }

    this.throwIfErrors(errors, 'Invalid meal box selection');
    return items;
  }

  private duplicateErrors(selectedItems: SelectedItemInput[]) {
    const keys = new Set<string>();
    const swapTargets = new Set<string>();
    const errors: string[] = [];
    for (const item of selectedItems) {
      const key = `${item.categoryId}:${item.menuItemId}:${item.replacedMenuItemId ?? ''}`;
      if (keys.has(key)) {
        errors.push('Duplicate menu selections are not allowed');
        break;
      }
      keys.add(key);
      if (!item.replacedMenuItemId) continue;
      if (swapTargets.has(item.replacedMenuItemId)) {
        errors.push(
          `Only one replacement can be selected for ${item.replacedMenuItemId}`,
        );
        break;
      }
      swapTargets.add(item.replacedMenuItemId);
    }
    return errors;
  }

  private throwIfErrors(errors: string[], message: string) {
    if (errors.length) {
      throw new BadRequestException({ message, errors });
    }
  }

  serialize(quote: Awaited<ReturnType<PricingService['quote']>>) {
    return {
      ...quote,
      basePerPlatePrice: quote.basePerPlatePrice.toFixed(2),
      totalCustomizationCharges: quote.totalCustomizationCharges.toFixed(2),
      finalPerPlatePrice: quote.finalPerPlatePrice.toFixed(2),
      totalAmount: quote.totalAmount.toFixed(2),
      items: quote.items.map((item) => ({
        ...item,
        itemPrice: item.itemPrice.toFixed(2),
        includedValue: item.includedValue.toFixed(2),
        adjustmentAmount: item.adjustmentAmount.toFixed(2),
        quantity: item.quantity,
        totalAdjustmentAmount: item.totalAdjustmentAmount.toFixed(2),
      })),
    };
  }
}
