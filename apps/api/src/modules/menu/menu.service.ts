import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { MenuItemsQueryDto } from './dto/menu-items-query.dto';
import { ImportMenuItemsDto } from './dto/import-menu-items.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.menuCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        displayOrder: true,
        isActive: true,
      },
    });
  }

  async listItems(query: MenuItemsQueryDto) {
    const items = await this.prisma.menuItem.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        category: { isActive: true },
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.isVeg !== undefined ? { isVeg: query.isVeg } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                {
                  description: { contains: query.search, mode: 'insensitive' },
                },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
    });

    return items.map((item) => this.serializeItem(item));
  }

  async getItem(id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: {
        id,
        isActive: true,
        deletedAt: null,
        category: { isActive: true },
      },
      include: { category: true },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return this.serializeItem(item);
  }

  listAdminCategories() {
    return this.prisma.menuCategory.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  createCategory(dto: CreateMenuCategoryDto) {
    return this.prisma.menuCategory.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateMenuCategoryDto) {
    await this.assertCategory(id);
    return this.prisma.menuCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() }
          : {}),
        ...(dto.displayOrder !== undefined
          ? { displayOrder: dto.displayOrder }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async listAdminItems(query: MenuItemsQueryDto) {
    const items = await this.prisma.menuItem.findMany({
      where: {
        deletedAt: null,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.isVeg !== undefined ? { isVeg: query.isVeg } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: { category: true },
      orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
    });

    return items.map((item) => this.serializeItem(item));
  }

  async createItem(dto: CreateMenuItemDto) {
    await this.assertCategory(dto.categoryId);
    const item = await this.prisma.menuItem.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        boxPrice: new Prisma.Decimal(dto.boxPrice),
        generalPrice: new Prisma.Decimal(dto.generalPrice),
        isVeg: dto.isVeg ?? true,
        isActive: dto.isActive ?? true,
        imageUrl: dto.imageUrl,
      },
      include: { category: true },
    });
    return this.serializeItem(item);
  }

  async importItems(dto: ImportMenuItemsDto) {
    if (!dto.rows.length) throw new BadRequestException('Import has no rows');

    return this.prisma.$transaction(async (transaction) => {
      const categories = await transaction.menuCategory.findMany();
      const categoryByName = new Map(
        categories.map((category) => [category.name.trim().toLowerCase(), category]),
      );
      const existingItems = await transaction.menuItem.findMany({
        where: { deletedAt: null },
      });
      const itemByKey = new Map(
        existingItems.map((item) => [
          `${item.categoryId}:${item.name.trim().toLowerCase()}`,
          item,
        ]),
      );
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let nextCategoryOrder = categories.reduce(
        (maximum, category) => Math.max(maximum, category.displayOrder),
        0,
      );

      for (const row of dto.rows) {
        const categoryName = row.category.trim();
        const categoryKey = categoryName.toLowerCase();
        let category = categoryByName.get(categoryKey);
        if (!category && dto.createMissingCategories) {
          category = await transaction.menuCategory.create({
            data: {
              name: categoryName,
              displayOrder: ++nextCategoryOrder,
              isActive: true,
            },
          });
          categoryByName.set(categoryKey, category);
        }
        if (!category) {
          throw new BadRequestException(
            `Category “${categoryName}” does not exist`,
          );
        }

        const name = row.name.trim();
        const itemKey = `${category.id}:${name.toLowerCase()}`;
        const existing = itemByKey.get(itemKey);
        const data = {
          categoryId: category.id,
          name,
          description: row.description?.trim() || null,
          boxPrice: new Prisma.Decimal(row.boxPrice),
          generalPrice: new Prisma.Decimal(row.generalPrice),
          isVeg: row.foodType === 'VEG',
          isActive: row.isActive ?? true,
          imageUrl: row.imageUrl?.trim() || null,
        };

        if (existing) {
          if (dto.duplicateStrategy === 'SKIP') {
            skipped += 1;
            continue;
          }
          const updatedItem = await transaction.menuItem.update({
            where: { id: existing.id },
            data,
          });
          itemByKey.set(itemKey, updatedItem);
          updated += 1;
        } else {
          const createdItem = await transaction.menuItem.create({ data });
          itemByKey.set(itemKey, createdItem);
          created += 1;
        }
      }

      return { total: dto.rows.length, created, updated, skipped };
    });
  }

  async updateItem(id: string, dto: UpdateMenuItemDto) {
    await this.assertItem(id);
    if (dto.categoryId) {
      await this.assertCategory(dto.categoryId);
    }

    const item = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() }
          : {}),
        ...(dto.boxPrice !== undefined
          ? { boxPrice: new Prisma.Decimal(dto.boxPrice) }
          : {}),
        ...(dto.generalPrice !== undefined
          ? { generalPrice: new Prisma.Decimal(dto.generalPrice) }
          : {}),
        ...(dto.isVeg !== undefined ? { isVeg: dto.isVeg } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      },
      include: { category: true },
    });
    return this.serializeItem(item);
  }

  async deleteItem(id: string) {
    await this.assertItem(id);
    await this.prisma.menuItem.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { success: true };
  }

  private async assertCategory(id: string) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Menu category not found');
    return category;
  }

  private async assertItem(id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  private serializeItem<
    T extends {
      boxPrice: Prisma.Decimal;
      generalPrice: Prisma.Decimal;
      category?: unknown;
    },
  >(item: T) {
    return {
      ...item,
      boxPrice: item.boxPrice.toFixed(2),
      generalPrice: item.generalPrice.toFixed(2),
    };
  }
}
