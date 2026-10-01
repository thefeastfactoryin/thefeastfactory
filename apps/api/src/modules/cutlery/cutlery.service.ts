import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveCutleryItemDto } from './dto/save-cutlery-item.dto';
import { UpdateCartCutleryDto } from './dto/update-cart-cutlery.dto';

@Injectable()
export class CutleryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = true) {
    const rows = await this.prisma.cutleryItem.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.serialize(row));
  }

  async create(dto: SaveCutleryItemDto) {
    this.validatePrice(dto.unitPrice);
    return this.serialize(
      await this.prisma.cutleryItem.create({ data: this.data(dto) }),
    );
  }

  async update(id: string, dto: SaveCutleryItemDto) {
    this.validatePrice(dto.unitPrice);
    const exists = await this.prisma.cutleryItem.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Cutlery item not found');
    return this.serialize(
      await this.prisma.cutleryItem.update({
        where: { id },
        data: this.data(dto),
      }),
    );
  }

  async catalogForCart(cartId: string) {
    const [catalog, selections] = await Promise.all([
      this.prisma.cutleryItem.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.cartCutleryItem.findMany({ where: { cartId } }),
    ]);
    const quantities = new Map(
      selections.map((row) => [row.cutleryItemId, row.quantity]),
    );
    return catalog.map((item) => ({
      ...this.serialize(item),
      quantity: quantities.get(item.id) ?? 0,
      lineTotal: item.unitPrice.mul(quantities.get(item.id) ?? 0).toFixed(2),
    }));
  }

  async replaceCartSelections(
    userId: string,
    cartId: string,
    dto: UpdateCartCutleryDto,
  ) {
    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, userId, status: CartStatus.ACTIVE },
      select: { id: true },
    });
    if (!cart) throw new NotFoundException('Active cart not found');
    const unique = new Map<string, number>();
    for (const row of dto.items) {
      if (row.quantity > 10000)
        throw new BadRequestException('Cutlery quantity is too high');
      if (unique.has(row.itemId))
        throw new BadRequestException(
          'Duplicate cutlery items are not allowed',
        );
      unique.set(row.itemId, row.quantity);
    }
    const ids = [...unique.keys()];
    const active = ids.length
      ? await this.prisma.cutleryItem.findMany({
          where: { id: { in: ids }, isActive: true },
          select: { id: true },
        })
      : [];
    if (active.length !== ids.length)
      throw new BadRequestException(
        'One or more cutlery items are unavailable',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.cartCutleryItem.deleteMany({ where: { cartId } });
      const selected = [...unique.entries()].filter(
        ([, quantity]) => quantity > 0,
      );
      if (selected.length) {
        await tx.cartCutleryItem.createMany({
          data: selected.map(([cutleryItemId, quantity]) => ({
            cartId,
            cutleryItemId,
            quantity,
          })),
        });
      }
      await tx.cart.update({
        where: { id: cartId },
        data: {
          cutleryExtraCount: selected.reduce(
            (sum, [, quantity]) => sum + quantity,
            0,
          ),
          lastQuotedAt: null,
        },
      });
    });
    return this.catalogForCart(cartId);
  }

  async quote(cartId: string) {
    const items = await this.catalogForCart(cartId);
    const total = items.reduce(
      (sum, item) => sum.plus(new Prisma.Decimal(item.lineTotal)),
      new Prisma.Decimal(0),
    );
    return { items, total };
  }

  private data(dto: SaveCutleryItemDto) {
    return {
      name: dto.name.trim(),
      extraLabel: dto.extraLabel?.trim() || null,
      description: dto.description?.trim() || null,
      unitLabel: dto.unitLabel.trim(),
      unitPrice: new Prisma.Decimal(dto.unitPrice),
      includedQuantity: dto.includedQuantity ?? 0,
      imageUrl: dto.imageUrl?.trim() || null,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    };
  }

  private validatePrice(value: string) {
    const price = new Prisma.Decimal(value);
    if (price.isNegative() || price.greaterThan(100000)) {
      throw new BadRequestException('Unit price must be between 0 and 100000');
    }
  }

  private serialize<T extends { unitPrice: Prisma.Decimal }>(row: T) {
    return { ...row, unitPrice: row.unitPrice.toFixed(2) };
  }
}
