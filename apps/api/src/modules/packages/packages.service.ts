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
import { PricingService } from '../pricing/pricing.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { CreatePackageVersionDto } from './dto/create-package-version.dto';
import {
  PackageSelectionDto,
  SelectedPackageItemDto,
} from './dto/package-selection.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { UpdatePackageVersionDto } from './dto/update-package-version.dto';
import { UpsertPackageMenuItemDto } from './dto/upsert-package-menu-item.dto';
import { ReplacePackageCompositionDto } from './dto/replace-package-composition.dto';
import { PreviewPackageQuoteDto } from './dto/preview-package-quote.dto';
import { UpdatePackageRegionAvailabilityDto } from './dto/update-package-region-availability.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async listPackages(regionId?: string) {
    const packages = await this.prisma.package.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        regionAvailabilities: regionId ? { where: { regionId } } : false,
        versions: {
          where: { isActive: true, publishedAt: { not: null } },
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return packages
      .filter(
        (pkg) =>
          !regionId ||
          !(pkg.regionAvailabilities?.some((row) => !row.isAvailable) ?? false),
      )
      .map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        imageUrl: pkg.imageUrl,
        badgeLabel: pkg.badgeLabel,
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

  async getConfiguration(versionId: string, regionId?: string) {
    const version = await this.loadVersionConfiguration(
      versionId,
      true,
      regionId,
    );
    return this.serializeConfiguration(version, true, regionId);
  }

  async previewQuote(versionId: string, dto: PreviewPackageQuoteDto) {
    const quote = await this.pricing.quote(
      versionId,
      dto.guestCount,
      dto.selectedItems,
      dto.regionId,
    );
    return { valid: true, errors: [], ...this.pricing.serialize(quote) };
  }

  async getAdminConfiguration(versionId: string) {
    const version = await this.loadVersionConfiguration(versionId, false);
    return this.serializeConfiguration(version, false);
  }

  async getRegionAvailability(versionId: string) {
    const version = await this.loadVersionConfiguration(versionId, false);
    if (version.package.type !== PackageType.ORDER_BY_KG) {
      throw new BadRequestException(
        'Location availability is configured here only for Order by KG menus',
      );
    }
    const regions = await this.prisma.operatingRegion.findMany({
      orderBy: [{ publicDisplayOrder: 'asc' }, { name: 'asc' }],
    });
    const packageRows = await this.prisma.packageRegionAvailability.findMany({
      where: { packageId: version.packageId },
    });
    const packageByRegion = new Map(
      packageRows.map((row) => [row.regionId, row.isAvailable]),
    );
    const itemRows = version.packageMenuItems.filter(
      (row) => row.role === PackageMenuItemRole.CUSTOM_SELECTABLE,
    );
    const overrides =
      await this.prisma.packageMenuItemRegionAvailability.findMany({
        where: { packageMenuItemId: { in: itemRows.map((row) => row.id) } },
      });
    const availabilityByKey = new Map(
      overrides.map((row) => [
        `${row.regionId}:${row.packageMenuItemId}`,
        row.isAvailable,
      ]),
    );
    return regions.map((region) => ({
      region: {
        ...region,
        centerLatitude: region.centerLatitude.toFixed(8),
        centerLongitude: region.centerLongitude.toFixed(8),
        serviceRadiusKm: region.serviceRadiusKm.toFixed(2),
        deliveryFeePerKm: region.deliveryFeePerKm.toFixed(2),
      },
      isAvailable: packageByRegion.get(region.id) ?? true,
      items: itemRows.map((row) => ({
        packageMenuItemId: row.id,
        menuItemId: row.menuItemId,
        menuItemName: row.menuItem.name,
        categoryName: row.category.name,
        pricePerKg: row.menuItem.pricePerKg?.toFixed(2) ?? null,
        isAvailable: availabilityByKey.get(`${region.id}:${row.id}`) ?? true,
      })),
    }));
  }

  async updateRegionAvailability(
    versionId: string,
    regionId: string,
    dto: UpdatePackageRegionAvailabilityDto,
  ) {
    const version = await this.loadVersionConfiguration(versionId, false);
    if (version.package.type !== PackageType.ORDER_BY_KG) {
      throw new BadRequestException(
        'Location availability is supported only for Order by KG menus',
      );
    }
    const region = await this.prisma.operatingRegion.findUnique({
      where: { id: regionId },
      select: { id: true },
    });
    if (!region) throw new NotFoundException('Operating region not found');
    const allowedIds = new Set(version.packageMenuItems.map((row) => row.id));
    if (dto.items.some((item) => !allowedIds.has(item.packageMenuItemId))) {
      throw new BadRequestException(
        'One or more dishes do not belong to this KG menu version',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.packageRegionAvailability.upsert({
        where: {
          packageId_regionId: { packageId: version.packageId, regionId },
        },
        update: { isAvailable: dto.isAvailable },
        create: {
          packageId: version.packageId,
          regionId,
          isAvailable: dto.isAvailable,
        },
      });
      for (const item of dto.items) {
        await tx.packageMenuItemRegionAvailability.upsert({
          where: {
            packageMenuItemId_regionId: {
              packageMenuItemId: item.packageMenuItemId,
              regionId,
            },
          },
          update: { isAvailable: item.isAvailable },
          create: {
            packageMenuItemId: item.packageMenuItemId,
            regionId,
            isAvailable: item.isAvailable,
          },
        });
      }
    });
    return this.getRegionAvailability(versionId);
  }

  async validateSelection(versionId: string, dto: PackageSelectionDto) {
    const version = await this.loadVersionConfiguration(versionId, true);
    if (version.package.type === PackageType.ORDER_BY_KG) {
      const quote = await this.pricing.quote(versionId, 1, dto.selectedItems);
      return { valid: true, errors: [], ...this.pricing.serialize(quote) };
    }
    const result = await this.evaluateSelection(version, dto);
    return { valid: result.errors.length === 0, errors: result.errors };
  }

  async priceSelection(versionId: string, dto: PackageSelectionDto) {
    const version = await this.loadVersionConfiguration(versionId, true);
    if (version.package.type === PackageType.ORDER_BY_KG) {
      const quote = await this.pricing.quote(versionId, 1, dto.selectedItems);
      return { valid: true, errors: [], ...this.pricing.serialize(quote) };
    }
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
        imageUrl: dto.imageUrl?.trim() || null,
        badgeLabel: dto.badgeLabel?.trim() || null,
        type: dto.type ?? PackageType.FIXED_PACKAGE,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        featuredOrder: dto.featuredOrder,
      },
    });
  }

  async updatePackage(id: string, dto: UpdatePackageDto) {
    const current = await this.assertPackage(id);
    if (
      dto.type &&
      dto.type !== current.type &&
      (dto.type === PackageType.ORDER_BY_KG ||
        current.type === PackageType.ORDER_BY_KG)
    ) {
      throw new BadRequestException(
        'Create a new package to change between kg and per-person ordering',
      );
    }
    return this.prisma.package.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() }
          : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl?.trim() || null }
          : {}),
        ...(dto.badgeLabel !== undefined
          ? { badgeLabel: dto.badgeLabel?.trim() || null }
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
    const pkg = await this.assertPackage(packageId);
    if (pkg.type === PackageType.ORDER_BY_KG) {
      const kgDefaultWeightGrams = dto.kgDefaultWeightGrams ?? 1000;
      const kgWeightIncrementGrams = dto.kgWeightIncrementGrams ?? 500;
      dto = {
        ...dto,
        basePricePerPlate: '0',
        minGuestCount: 1,
        maxGuestCount: null,
        kgDefaultWeightGrams,
        kgWeightIncrementGrams,
      };
      this.assertKgWeightSettings(
        kgDefaultWeightGrams,
        kgWeightIncrementGrams,
      );
    }
    this.assertGuestRange(dto.minGuestCount ?? 10, dto.maxGuestCount);
    const version = await this.prisma.packageVersion.create({
      data: {
        packageId,
        versionNo: dto.versionNo,
        basePricePerPlate: new Prisma.Decimal(dto.basePricePerPlate),
        minGuestCount: dto.minGuestCount ?? 10,
        maxGuestCount: dto.maxGuestCount,
        kgDefaultWeightGrams: dto.kgDefaultWeightGrams ?? 1000,
        kgWeightIncrementGrams: dto.kgWeightIncrementGrams ?? 500,
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
    const pkg = await this.assertPackage(current.packageId);
    if (pkg.type === PackageType.ORDER_BY_KG) {
      dto = {
        ...dto,
        basePricePerPlate: '0',
        minGuestCount: 1,
        maxGuestCount: null,
      };
      this.assertKgWeightSettings(
        dto.kgDefaultWeightGrams ?? current.kgDefaultWeightGrams,
        dto.kgWeightIncrementGrams ?? current.kgWeightIncrementGrams,
      );
    }
    this.assertGuestRange(
      dto.minGuestCount ?? current.minGuestCount,
      dto.maxGuestCount === undefined
        ? current.maxGuestCount
        : dto.maxGuestCount,
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
        ...(dto.kgDefaultWeightGrams !== undefined
          ? { kgDefaultWeightGrams: dto.kgDefaultWeightGrams }
          : {}),
        ...(dto.kgWeightIncrementGrams !== undefined
          ? { kgWeightIncrementGrams: dto.kgWeightIncrementGrams }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.publishedAt !== undefined
          ? { publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null }
          : {}),
      },
    });
  }

  async upsertMenuItem(versionId: string, dto: UpsertPackageMenuItemDto) {
    const version = await this.assertVersion(versionId);
    const pkg = await this.assertPackage(version.packageId);
    if (
      pkg.type === PackageType.ORDER_BY_KG &&
      (dto.role !== PackageMenuItemRole.CUSTOM_SELECTABLE || dto.isSwappable)
    ) {
      throw new BadRequestException(
        'Kg dishes must be selectable without swaps',
      );
    }
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

  async replaceComposition(
    versionId: string,
    dto: ReplacePackageCompositionDto,
  ) {
    const version = await this.prisma.packageVersion.findUnique({
      where: { id: versionId },
      include: { package: { select: { type: true } } },
    });
    if (!version) throw new NotFoundException('Package version not found');
    const allowedRoles: PackageMenuItemRole[] =
      version.package.type === PackageType.MEAL_BOX
        ? [PackageMenuItemRole.INCLUDED]
        : version.package.type === PackageType.FIXED_PACKAGE
          ? [PackageMenuItemRole.INCLUDED, PackageMenuItemRole.EXTRA]
          : [PackageMenuItemRole.CUSTOM_SELECTABLE];
    const invalidRole = dto.items.find(
      (item) => !allowedRoles.includes(item.role),
    );
    if (invalidRole) {
      throw new BadRequestException(
        'One or more menu item roles are not valid for this package type',
      );
    }
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: dto.items.map((item) => item.menuItemId) },
        deletedAt: null,
      },
      select: { id: true, categoryId: true },
    });
    const menuItemsById = new Map(
      menuItems.map((item) => [item.id, item] as const),
    );
    const invalidItem = dto.items.find(
      (item) =>
        menuItemsById.get(item.menuItemId)?.categoryId !== item.categoryId,
    );
    if (invalidItem) {
      throw new BadRequestException(
        'One or more menu items do not belong to the selected category',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.packageMenuItem.deleteMany({
        where: { packageVersionId: versionId },
      });
      if (!dto.items.length) return;
      await transaction.packageMenuItem.createMany({
        data: dto.items.map((item) => ({
          packageVersionId: versionId,
          categoryId: item.categoryId,
          menuItemId: item.menuItemId,
          role: item.role,
          isAvailable: item.isAvailable ?? true,
          isSwappable: item.isSwappable ?? false,
          displayOrder: item.displayOrder ?? 0,
        })),
      });
    });
    return { success: true, configuredItems: dto.items.length };
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
    regionId?: string,
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
        package: {
          include: {
            regionAvailabilities: regionId ? { where: { regionId } } : false,
          },
        },
        packageMenuItems: {
          where: publicOnly
            ? {
                isAvailable: true,
                menuItem: { isActive: true, deletedAt: null },
              }
            : {},
          include: {
            menuItem: true,
            category: true,
            regionAvailabilities: regionId ? { where: { regionId } } : false,
          },
          orderBy: [{ displayOrder: 'asc' }, { menuItem: { name: 'asc' } }],
        },
      },
    });
    if (!version) throw new NotFoundException('Package version not found');
    if (
      publicOnly &&
      regionId &&
      version.package.regionAvailabilities?.some((row) => !row.isAvailable)
    ) {
      throw new NotFoundException(
        'Order by KG is currently unavailable at this location',
      );
    }
    return version;
  }

  private async serializeConfiguration(
    version: VersionConfiguration,
    publicOnly: boolean,
    regionId?: string,
  ) {
    const availableVersion =
      publicOnly && regionId
        ? {
            ...version,
            packageMenuItems: version.packageMenuItems.filter(
              (row) =>
                !row.regionAvailabilities?.some(
                  (availability) => !availability.isAvailable,
                ),
            ),
          }
        : version;
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
      kgDefaultWeightGrams: version.kgDefaultWeightGrams,
      kgWeightIncrementGrams: version.kgWeightIncrementGrams,
      categoryRules:
        publicOnly && version.package.type === PackageType.ORDER_BY_KG
          ? this.configuredCategoryRules({
              ...availableVersion,
              packageMenuItems: availableVersion.packageMenuItems.filter(
                (row) =>
                  row.category.isActive &&
                  row.menuItem.pricePerKg?.greaterThan(0),
              ),
            })
          : !publicOnly
            ? this.configuredCategoryRules(version)
            : version.package.type === PackageType.CUSTOM_PACKAGE
              ? await this.customCategoryRules(version, publicOnly)
              : version.package.type === PackageType.MEAL_BOX
                ? await this.mealBoxCategoryRules(version)
                : await this.fixedPackageCategoryRules(version),
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
        : version.package.type === PackageType.CUSTOM_PACKAGE ||
            version.package.type === PackageType.ORDER_BY_KG
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

  private async fixedPackageCategoryRules(version: VersionConfiguration) {
    const configuredRules = this.configuredCategoryRules(version);
    const includedRows = version.packageMenuItems.filter(
      (row) => row.role === PackageMenuItemRole.INCLUDED && row.isSwappable,
    );
    if (!includedRows.length) return configuredRules;

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

    const ruleByCategoryId = new Map(
      configuredRules.map((rule) => [rule.category.id, rule]),
    );
    for (const included of includedRows) {
      const rule = ruleByCategoryId.get(included.categoryId);
      if (!rule) continue;
      const replacements = catalogItems
        .filter(
          (item) =>
            item.categoryId === included.categoryId &&
            item.isVeg === included.menuItem.isVeg &&
            item.id !== included.menuItemId,
        )
        .map((item) => {
          const adjustmentAmount = Prisma.Decimal.max(
            item.generalPrice.minus(included.menuItem.generalPrice),
            0,
          );
          return this.serializeConfigItem(
            item,
            PackageMenuItemRole.INCLUDED,
            false,
            {
              itemPrice: item.generalPrice,
              includedValue: included.menuItem.generalPrice,
              adjustmentAmount,
              swapForMenuItemId: included.menuItemId,
              swapForMenuItemName: included.menuItem.name,
            },
          );
        });
      rule.items.push(...replacements);
    }

    return configuredRules;
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
      pricePerKg?: Prisma.Decimal | null;
      isVeg: boolean;
      isActive: boolean;
      imageUrl: string | null;
    },
    role: PackageMenuItemRole,
    isSwappable = false,
    overrides?: {
      itemPrice?: Prisma.Decimal;
      includedValue?: Prisma.Decimal;
      adjustmentAmount?: Prisma.Decimal;
      swapForMenuItemId?: string | null;
      swapForMenuItemName?: string | null;
    },
  ) {
    const isBox = role === PackageMenuItemRole.INCLUDED;
    const itemPrice =
      overrides?.itemPrice ?? (isBox ? item.boxPrice : item.generalPrice);
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
      pricePerKg: item.pricePerKg?.toFixed(2) ?? null,
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
    const hasConfiguredAllowlist = version.packageMenuItems.some(
      (row) => row.role === PackageMenuItemRole.CUSTOM_SELECTABLE,
    );
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: dto.selectedItems.map((item) => item.menuItemId) },
        ...(hasConfiguredAllowlist
          ? {
              packageMenuItems: {
                some: {
                  packageVersionId: version.id,
                  role: PackageMenuItemRole.CUSTOM_SELECTABLE,
                  isAvailable: true,
                },
              },
            }
          : {}),
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

  private assertKgWeightSettings(
    defaultWeightGrams: number,
    incrementGrams: number,
  ) {
    const valid = (value: number) =>
      Number.isInteger(value) &&
      value >= 500 &&
      value <= 100000 &&
      value % 500 === 0;
    if (!valid(defaultWeightGrams) || !valid(incrementGrams)) {
      throw new BadRequestException(
        'KG starting weight and increment must be between 0.5 and 100 kg in 0.5 kg units',
      );
    }
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
        packageMenuItems: {
          where: { isAvailable: true },
          include: { menuItem: true, category: true },
        },
      },
    });
    if (!version) throw new NotFoundException('Package version not found');
    if (version.package.type === PackageType.ORDER_BY_KG) {
      if (!basePrice.isZero())
        throw new BadRequestException('Kg packages have no base price');
      const rows = version.packageMenuItems;
      if (
        !rows.length ||
        rows.some(
          (row) =>
            row.role !== PackageMenuItemRole.CUSTOM_SELECTABLE ||
            !row.category.isActive ||
            !row.menuItem.isActive ||
            row.menuItem.deletedAt ||
            !row.menuItem.pricePerKg?.greaterThan(0),
        )
      ) {
        throw new BadRequestException(
          'Kg packages require active selectable dishes with a positive price per kg',
        );
      }
    }
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
