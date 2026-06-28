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
import { CreatePackageDto } from './dto/create-package.dto';
import { CreatePackageVersionDto } from './dto/create-package-version.dto';
import {
  PackageSelectionDto,
  SelectedPackageItemDto,
} from './dto/package-selection.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { UpdatePackageVersionDto } from './dto/update-package-version.dto';
import { UpsertPackageMenuItemDto } from './dto/upsert-package-menu-item.dto';

type VersionConfiguration = Awaited<
  ReturnType<PackagesService['loadVersionConfiguration']>
>;
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
};

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPackages() {
    const packages = await this.prisma.package.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        versions: {
          where: { isActive: true, publishedAt: { not: null } },
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      displayOrder: pkg.displayOrder,
      isFeatured: pkg.isFeatured,
      featuredOrder: pkg.featuredOrder,
      type: pkg.type,
      isCustom: pkg.type === PackageType.CUSTOM_PACKAGE,
      activeVersion: pkg.versions[0]
        ? this.serializeVersion(pkg.versions[0])
        : null,
    }));
  }

  async getActiveVersion(packageId: string) {
    const version = await this.prisma.packageVersion.findFirst({
      where: {
        packageId,
        isActive: true,
        publishedAt: { not: null },
        package: { isActive: true, deletedAt: null },
      },
      include: { package: true },
      orderBy: { versionNo: 'desc' },
    });
    if (!version)
      throw new NotFoundException('Active package version not found');
    return {
      ...this.serializeVersion(version),
      packageName: version.package.name,
      packageType: version.package.type,
      isCustom: version.package.type === PackageType.CUSTOM_PACKAGE,
    };
  }

  async getConfiguration(versionId: string) {
    const version = await this.loadVersionConfiguration(versionId, true);
    return this.serializeConfiguration(version, true);
  }

  async getAdminConfiguration(versionId: string) {
    const version = await this.loadVersionConfiguration(versionId, false);
    return this.serializeConfiguration(version, false);
  }

  async validateSelection(versionId: string, dto: PackageSelectionDto) {
    const version = await this.loadVersionConfiguration(versionId, true);
    const result = await this.evaluateSelection(version, dto);
    return { valid: result.errors.length === 0, errors: result.errors };
  }

  async priceSelection(versionId: string, dto: PackageSelectionDto) {
    const version = await this.loadVersionConfiguration(versionId, true);
    const result = await this.evaluateSelection(version, dto);
    const totalCustomizationCharges = result.items.reduce(
      (total, item) => total.plus(item.adjustmentAmount),
      new Prisma.Decimal(0),
    );
    return {
      valid: result.errors.length === 0,
      errors: result.errors,
      basePricePerPlate: version.basePricePerPlate.toFixed(2),
      totalCustomizationCharges: totalCustomizationCharges.toFixed(2),
      finalPerPlatePrice: version.basePricePerPlate
        .plus(totalCustomizationCharges)
        .toFixed(2),
      items: result.items.map((item) => this.serializeQuoteItem(item)),
    };
  }

  listAdminPackages() {
    return this.prisma.package.findMany({
      where: { deletedAt: null },
      include: { versions: { orderBy: { versionNo: 'desc' } } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  createPackage(dto: CreatePackageDto) {
    return this.prisma.package.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        type: dto.type ?? PackageType.FIXED_PACKAGE,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        featuredOrder: dto.featuredOrder,
      },
    });
  }

  async updatePackage(id: string, dto: UpdatePackageDto) {
    await this.assertPackage(id);
    return this.prisma.package.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.displayOrder !== undefined
          ? { displayOrder: dto.displayOrder }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
        ...(dto.featuredOrder !== undefined
          ? { featuredOrder: dto.featuredOrder }
          : {}),
      },
    });
  }

  async createVersion(packageId: string, dto: CreatePackageVersionDto) {
    await this.assertPackage(packageId);
    this.assertGuestRange(dto.minGuestCount ?? 10, dto.maxGuestCount);
    const version = await this.prisma.packageVersion.create({
      data: {
        packageId,
        versionNo: dto.versionNo,
        basePricePerPlate: new Prisma.Decimal(dto.basePricePerPlate),
        minGuestCount: dto.minGuestCount ?? 10,
        maxGuestCount: dto.maxGuestCount,
        isActive: dto.isActive ?? true,
        publishedAt: null,
      },
    });
    if (!dto.publishedAt) return version;
    await this.assertPublishable(version.id, version.basePricePerPlate);
    return this.prisma.packageVersion.update({
      where: { id: version.id },
      data: { publishedAt: new Date(dto.publishedAt) },
    });
  }

  async updateVersion(id: string, dto: UpdatePackageVersionDto) {
    const current = await this.assertVersion(id);
    this.assertGuestRange(
      dto.minGuestCount ?? current.minGuestCount,
      dto.maxGuestCount ?? current.maxGuestCount,
    );
    if (dto.publishedAt) {
      await this.assertPublishable(
        id,
        dto.basePricePerPlate !== undefined
          ? new Prisma.Decimal(dto.basePricePerPlate)
          : current.basePricePerPlate,
      );
    }
    return this.prisma.packageVersion.update({
      where: { id },
      data: {
        ...(dto.versionNo !== undefined ? { versionNo: dto.versionNo } : {}),
        ...(dto.basePricePerPlate !== undefined
          ? { basePricePerPlate: new Prisma.Decimal(dto.basePricePerPlate) }
          : {}),
        ...(dto.minGuestCount !== undefined
          ? { minGuestCount: dto.minGuestCount }
          : {}),
        ...(dto.maxGuestCount !== undefined
          ? { maxGuestCount: dto.maxGuestCount }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.publishedAt !== undefined
          ? { publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null }
          : {}),
      },
    });
  }

  async upsertMenuItem(versionId: string, dto: UpsertPackageMenuItemDto) {
    await this.assertVersion(versionId);
    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: dto.menuItemId,
        categoryId: dto.categoryId,
        deletedAt: null,
      },
    });
    if (!item)
      throw new BadRequestException(
        'Menu item does not belong to the selected category',
      );
    const role = dto.role ?? PackageMenuItemRole.INCLUDED;
    return this.prisma.packageMenuItem.upsert({
      where: {
        packageVersionId_menuItemId_role: {
          packageVersionId: versionId,
          menuItemId: dto.menuItemId,
          role,
        },
      },
      update: {
        categoryId: dto.categoryId,
        isAvailable: dto.isAvailable ?? true,
        isSwappable: dto.isSwappable ?? false,
        displayOrder: dto.displayOrder ?? 0,
      },
      create: {
        packageVersionId: versionId,
        categoryId: dto.categoryId,
        menuItemId: dto.menuItemId,
        role,
        isAvailable: dto.isAvailable ?? true,
        isSwappable: dto.isSwappable ?? false,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async removeMenuItem(versionId: string, menuItemId: string, role: string) {
    if (
      !Object.values(PackageMenuItemRole).includes(role as PackageMenuItemRole)
    ) {
      throw new BadRequestException('Invalid package menu role');
    }
    await this.prisma.packageMenuItem.deleteMany({
      where: {
        packageVersionId: versionId,
        menuItemId,
        role: role as PackageMenuItemRole,
      },
    });
    return { success: true };
  }

  private async loadVersionConfiguration(
    versionId: string,
    publicOnly: boolean,
  ) {
    const version = await this.prisma.packageVersion.findFirst({
      where: {
        id: versionId,
        ...(publicOnly
          ? {
              isActive: true,
              publishedAt: { not: null },
              package: { isActive: true, deletedAt: null },
            }
          : {}),
      },
      include: {
        package: true,
        packageMenuItems: {
          where: publicOnly
            ? {
                isAvailable: true,
                menuItem: { isActive: true, deletedAt: null },
              }
            : {},
          include: { menuItem: true, category: true },
          orderBy: [{ displayOrder: 'asc' }, { menuItem: { name: 'asc' } }],
        },
      },
    });
    if (!version) throw new NotFoundException('Package version not found');
    return version;
  }

  private async serializeConfiguration(
    version: VersionConfiguration,
    publicOnly: boolean,
  ) {
    return {
      id: version.id,
      packageId: version.packageId,
      packageName: version.package.name,
      packageType: version.package.type,
      isCustom: version.package.type === PackageType.CUSTOM_PACKAGE,
      versionNo: version.versionNo,
      basePricePerPlate: version.basePricePerPlate.toFixed(2),
      minGuestCount: version.minGuestCount,
      maxGuestCount: version.maxGuestCount,
      categoryRules: !publicOnly
        ? this.configuredCategoryRules(version)
        : version.package.type === PackageType.CUSTOM_PACKAGE
          ? await this.customCategoryRules(version, publicOnly)
          : version.package.type === PackageType.MEAL_BOX
            ? await this.mealBoxCategoryRules(version)
            : this.configuredCategoryRules(version),
    };
  }

  private configuredCategoryRules(version: VersionConfiguration) {
    const byCategory = new Map<
      string,
      {
        category: VersionConfiguration['packageMenuItems'][number]['category'];
        items: VersionConfiguration['packageMenuItems'];
      }
    >();
    const selectableRoles =
      version.package.type === PackageType.FIXED_PACKAGE
        ? new Set<PackageMenuItemRole>([
            PackageMenuItemRole.INCLUDED,
            PackageMenuItemRole.EXTRA,
          ])
        : version.package.type === PackageType.CUSTOM_PACKAGE
          ? new Set<PackageMenuItemRole>([
              PackageMenuItemRole.CUSTOM_SELECTABLE,
            ])
          : new Set<PackageMenuItemRole>([PackageMenuItemRole.INCLUDED]);
    for (const row of version.packageMenuItems) {
      if (!selectableRoles.has(row.role)) continue;
      const current = byCategory.get(row.categoryId) ?? {
        category: row.category,
        items: [],
      };
      current.items.push(row);
      byCategory.set(row.categoryId, current);
    }

    return [...byCategory.values()].map(({ category, items }) => ({
      id: `configured-${version.id}-${category.id}`,
      category,
      minSelections: version.package.type === PackageType.MEAL_BOX ? 0 : 0,
      maxSelections: Math.max(items.length, 1),
      isMandatory: false,
      items: items.map((row) =>
        this.serializeConfigItem(row.menuItem, row.role, row.isSwappable),
      ),
    }));
  }

  private async mealBoxCategoryRules(version: VersionConfiguration) {
    const includedRows = version.packageMenuItems.filter(
      (row) => row.role === PackageMenuItemRole.INCLUDED,
    );
    const categoryIds = [...new Set(includedRows.map((row) => row.categoryId))];
    const catalogItems = await this.prisma.menuItem.findMany({
      where: {
        categoryId: { in: categoryIds },
        isActive: true,
        deletedAt: null,
      },
      include: { category: true },
      orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
    });

    const byCategory = new Map<
      string,
      {
        category: VersionConfiguration['packageMenuItems'][number]['category'];
        rows: VersionConfiguration['packageMenuItems'];
      }
    >();
    for (const row of includedRows) {
      const current = byCategory.get(row.categoryId) ?? {
        category: row.category,
        rows: [],
      };
      current.rows.push(row);
      byCategory.set(row.categoryId, current);
    }

    const includedRules = [...byCategory.values()].map(({ category, rows }) => {
      const items = rows.flatMap((included) => {
        const includedItem = this.serializeConfigItem(
          included.menuItem,
          PackageMenuItemRole.INCLUDED,
          included.isSwappable,
        );
        if (!included.isSwappable) return [includedItem];

        const replacements = catalogItems
          .filter(
            (item) =>
              item.categoryId === included.categoryId &&
              item.isVeg === included.menuItem.isVeg &&
              item.id !== included.menuItemId,
          )
          .map((item) => {
            const adjustmentAmount = Prisma.Decimal.max(
              item.boxPrice.minus(included.menuItem.boxPrice),
              0,
            );
            return this.serializeConfigItem(
              item,
              PackageMenuItemRole.INCLUDED,
              false,
              {
                includedValue: included.menuItem.boxPrice,
                adjustmentAmount,
                swapForMenuItemId: included.menuItemId,
                swapForMenuItemName: included.menuItem.name,
              },
            );
          });
        return [includedItem, ...replacements];
      });

      return {
        id: `meal-box-${version.id}-${category.id}`,
        category,
        minSelections: rows.length,
        maxSelections: rows.length,
        isMandatory: true,
        items,
      };
    });
    return includedRules;
  }

  private async customCategoryRules(
    version: VersionConfiguration,
    publicOnly: boolean,
  ) {
    const configured = version.packageMenuItems.filter(
      (row) => row.role === PackageMenuItemRole.CUSTOM_SELECTABLE,
    );
    if (configured.length) {
      return this.configuredCategoryRules({
        ...version,
        packageMenuItems: configured,
      } as VersionConfiguration);
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: {
        isActive: true,
        menuItems: {
          some: {
            ...(publicOnly ? { isActive: true, deletedAt: null } : {}),
          },
        },
      },
      include: {
        menuItems: {
          where: publicOnly ? { isActive: true, deletedAt: null } : {},
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return categories.map((category) => ({
      id: `custom-${category.id}`,
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
      },
      minSelections: 0,
      maxSelections: category.menuItems.length,
      isMandatory: false,
      items: category.menuItems.map((item) =>
        this.serializeConfigItem(item, PackageMenuItemRole.CUSTOM_SELECTABLE),
      ),
    }));
  }

  private serializeConfigItem(
    item: {
      id: string;
      categoryId: string;
      name: string;
      description: string | null;
      boxPrice: Prisma.Decimal;
      generalPrice: Prisma.Decimal;
      isVeg: boolean;
      isActive: boolean;
      imageUrl: string | null;
    },
    role: PackageMenuItemRole,
    isSwappable = false,
    overrides?: {
      includedValue?: Prisma.Decimal;
      adjustmentAmount?: Prisma.Decimal;
      swapForMenuItemId?: string | null;
      swapForMenuItemName?: string | null;
    },
  ) {
    const isBox = role === PackageMenuItemRole.INCLUDED;
    const itemPrice = isBox ? item.boxPrice : item.generalPrice;
    const includedValue =
      overrides?.includedValue ??
      (isBox ? item.boxPrice : new Prisma.Decimal(0));
    const adjustmentAmount =
      overrides?.adjustmentAmount ??
      (isBox ? new Prisma.Decimal(0) : item.generalPrice);
    return {
      ...item,
      role,
      isSwappable,
      swapForMenuItemId: overrides?.swapForMenuItemId ?? null,
      swapForMenuItemName: overrides?.swapForMenuItemName ?? null,
      isAvailable: item.isActive,
      boxPrice: item.boxPrice.toFixed(2),
      generalPrice: item.generalPrice.toFixed(2),
      itemPrice: itemPrice.toFixed(2),
      includedValue: includedValue.toFixed(2),
      adjustmentAmount: adjustmentAmount.toFixed(2),
    };
  }

  private async evaluateSelection(
    version: VersionConfiguration,
    dto: PackageSelectionDto,
  ) {
    if (version.package.type === PackageType.CUSTOM_PACKAGE) {
      return this.evaluateCustomSelection(version, dto);
    }
    if (version.package.type === PackageType.MEAL_BOX) {
      return this.evaluateMealBoxSelection(version, dto);
    }
    return this.evaluateFixedPackageSelection(version, dto);
  }

  private async evaluateCustomSelection(
    version: VersionConfiguration,
    dto: PackageSelectionDto,
  ) {
    const errors = this.duplicateErrors(dto.selectedItems);
    if (!dto.selectedItems.length) {
      errors.push('Choose at least one menu item');
    }
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: dto.selectedItems.map((item) => item.menuItemId) },
        packageMenuItems: {
          some: {
            packageVersionId: version.id,
            role: PackageMenuItemRole.CUSTOM_SELECTABLE,
            isAvailable: true,
          },
        },
        isActive: true,
        deletedAt: null,
      },
      include: { category: true },
    });
    const menuItemById = new Map(menuItems.map((item) => [item.id, item]));
    const items = dto.selectedItems.flatMap((selection) => {
      const menuItem = menuItemById.get(selection.menuItemId);
      if (!menuItem || menuItem.categoryId !== selection.categoryId) {
        errors.push(`Invalid menu item ${selection.menuItemId}`);
        return [];
      }
      return [
        this.quoteItem({
          categoryId: menuItem.categoryId,
          categoryName: menuItem.category.name,
          menuItemId: menuItem.id,
          menuItemName: menuItem.name,
          role: SelectedItemRole.CUSTOM,
          isVeg: menuItem.isVeg,
          itemPrice: menuItem.generalPrice,
          includedValue: new Prisma.Decimal(0),
          adjustmentAmount: menuItem.generalPrice,
        }),
      ];
    });
    return { errors, items };
  }

  private evaluateFixedPackageSelection(
    version: VersionConfiguration,
    dto: PackageSelectionDto,
  ) {
    const errors = this.duplicateErrors(dto.selectedItems);
    const extras = new Map(
      version.packageMenuItems
        .filter((row) => row.role === PackageMenuItemRole.EXTRA)
        .map((row) => [row.menuItemId, row]),
    );
    const includedItems = version.packageMenuItems
      .filter((row) => row.role === PackageMenuItemRole.INCLUDED)
      .map((row) =>
        this.quoteItem({
          categoryId: row.categoryId,
          categoryName: row.category.name,
          menuItemId: row.menuItemId,
          menuItemName: row.menuItem.name,
          role: SelectedItemRole.INCLUDED,
          isVeg: row.menuItem.isVeg,
          itemPrice: row.menuItem.generalPrice,
          includedValue: row.menuItem.generalPrice,
          adjustmentAmount: new Prisma.Decimal(0),
        }),
      );
    const selectedExtras = dto.selectedItems.flatMap((selection) => {
      const row = extras.get(selection.menuItemId);
      if (!row || row.categoryId !== selection.categoryId) {
        errors.push(`Menu item ${selection.menuItemId} is not a valid extra`);
        return [];
      }
      return [
        this.quoteItem({
          categoryId: row.categoryId,
          categoryName: row.category.name,
          menuItemId: row.menuItemId,
          menuItemName: row.menuItem.name,
          role: SelectedItemRole.EXTRA,
          isVeg: row.menuItem.isVeg,
          itemPrice: row.menuItem.generalPrice,
          includedValue: new Prisma.Decimal(0),
          adjustmentAmount: row.menuItem.generalPrice,
        }),
      ];
    });
    return { errors, items: [...includedItems, ...selectedExtras] };
  }

  private async evaluateMealBoxSelection(
    version: VersionConfiguration,
    dto: PackageSelectionDto,
  ) {
    const errors = this.duplicateErrors(dto.selectedItems);
    const includedRows = version.packageMenuItems.filter(
      (row) => row.role === PackageMenuItemRole.INCLUDED,
    );
    const includedById = new Map(
      includedRows.map((row) => [row.menuItemId, row]),
    );
    const replacements = new Map<string, SelectedPackageItemDto>();
    for (const selection of dto.selectedItems) {
      if (!selection.replacedMenuItemId) continue;
      replacements.set(selection.replacedMenuItemId, selection);
    }

    const replacementIds = [...replacements.values()].map(
      (item) => item.menuItemId,
    );
    const replacementRows = replacementIds.length
      ? await this.prisma.menuItem.findMany({
          where: {
            id: { in: replacementIds },
            isActive: true,
            deletedAt: null,
          },
        })
      : [];
    const replacementItems = new Map(
      replacementRows.map((item) => [item.id, item] as const),
    );

    const items: QuoteItem[] = [];
    for (const included of includedRows) {
      const replacement = replacements.get(included.menuItemId);
      if (!replacement) {
        items.push(
          this.quoteItem({
            categoryId: included.categoryId,
            categoryName: included.category.name,
            menuItemId: included.menuItemId,
            menuItemName: included.menuItem.name,
            role: SelectedItemRole.INCLUDED,
            isVeg: included.menuItem.isVeg,
            itemPrice: included.menuItem.boxPrice,
            includedValue: included.menuItem.boxPrice,
            adjustmentAmount: new Prisma.Decimal(0),
          }),
        );
        continue;
      }

      const replacementItem = replacementItems.get(replacement.menuItemId);
      if (!included.isSwappable) {
        errors.push(`${included.menuItem.name} cannot be swapped`);
        continue;
      }
      if (!replacementItem) {
        errors.push(`Invalid replacement item ${replacement.menuItemId}`);
        continue;
      }
      if (
        replacementItem.categoryId !== included.categoryId ||
        replacementItem.isVeg !== included.menuItem.isVeg
      ) {
        errors.push(
          `${replacementItem.name} is not eligible to replace ${included.menuItem.name}`,
        );
        continue;
      }
      const adjustmentAmount = Prisma.Decimal.max(
        replacementItem.boxPrice.minus(included.menuItem.boxPrice),
        0,
      );
      items.push(
        this.quoteItem({
          categoryId: replacementItem.categoryId,
          categoryName: included.category.name,
          menuItemId: replacementItem.id,
          menuItemName: replacementItem.name,
          replacedMenuItemId: included.menuItemId,
          replacedMenuItemName: included.menuItem.name,
          role: SelectedItemRole.SWAP,
          isVeg: replacementItem.isVeg,
          itemPrice: replacementItem.boxPrice,
          includedValue: included.menuItem.boxPrice,
          adjustmentAmount,
        }),
      );
    }

    for (const replacement of replacements.keys()) {
      if (!includedById.has(replacement)) {
        errors.push(
          `Replacement target ${replacement} is not in this meal box`,
        );
      }
    }

    return { errors, items };
  }

  private duplicateErrors(selectedItems: SelectedPackageItemDto[]) {
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

  private quoteItem(item: QuoteItem) {
    return item;
  }

  private serializeQuoteItem(item: QuoteItem) {
    return {
      ...item,
      itemPrice: item.itemPrice.toFixed(2),
      includedValue: item.includedValue.toFixed(2),
      adjustmentAmount: item.adjustmentAmount.toFixed(2),
    };
  }

  private serializeVersion<
    T extends { basePricePerPlate: Prisma.Decimal; publishedAt: Date | null },
  >(version: T) {
    return {
      ...version,
      basePricePerPlate: version.basePricePerPlate.toFixed(2),
      publishedAt: version.publishedAt?.toISOString() ?? null,
    };
  }

  private async assertPackage(id: string) {
    const pkg = await this.prisma.package.findFirst({
      where: { id, deletedAt: null },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  private async assertVersion(id: string) {
    const version = await this.prisma.packageVersion.findUnique({
      where: { id },
    });
    if (!version) throw new NotFoundException('Package version not found');
    return version;
  }

  private async assertPublishable(id: string, basePrice: Prisma.Decimal) {
    const version = await this.prisma.packageVersion.findUnique({
      where: { id },
      include: {
        package: true,
        packageMenuItems: { where: { isAvailable: true } },
      },
    });
    if (!version) throw new NotFoundException('Package version not found');
    const roles = new Set(version.packageMenuItems.map((row) => row.role));
    if (
      version.package.type === PackageType.MEAL_BOX &&
      !roles.has(PackageMenuItemRole.INCLUDED)
    )
      throw new BadRequestException('Meal boxes require included items');
    if (
      version.package.type === PackageType.FIXED_PACKAGE &&
      !roles.has(PackageMenuItemRole.INCLUDED)
    )
      throw new BadRequestException(
        'Fixed packages require locked included items',
      );
    if (version.package.type === PackageType.CUSTOM_PACKAGE) {
      if (!roles.has(PackageMenuItemRole.CUSTOM_SELECTABLE))
        throw new BadRequestException(
          'Custom packages require selectable items',
        );
      if (!basePrice.isZero())
        throw new BadRequestException('Custom package base price must be zero');
    }
  }

  private assertGuestRange(min: number, max?: number | null) {
    if (max !== undefined && max !== null && max < min) {
      throw new BadRequestException(
        'Maximum guest count must be at least minimum guest count',
      );
    }
  }
}
