import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartStatus, OrderStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { eventLocalInstant } from '../../common/event-time';
import {
  clockMinutes,
  nonNegativeIntegerSetting,
  positiveIntegerSetting,
} from '../../common/setting-values';
import { OrdersService } from '../orders/orders.service';
import { PricingService } from '../pricing/pricing.service';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import {
  CartSelectionItemDto,
  ReplaceCartItemsDto,
} from './dto/replace-cart-items.dto';

const cartInclude = Prisma.validator<Prisma.CartInclude>()({
  packageVersion: { include: { package: true } },
  address: true,
  region: true,
  items: {
    include: {
      category: true,
      menuItem: true,
      replacedMenuItem: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  order: { select: { id: true, orderStatus: true, paymentStatus: true } },
});
type CartWithDetails = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly orders: OrdersService,
    private readonly regions: OperatingRegionsService,
  ) {}

  async upsert(userId: string, dto: UpdateCartDto) {
    const cart = await this.createOrFetch(userId, {
      packageVersionId: dto.packageVersionId,
      regionId: dto.regionId,
    });
    const eventFields = [dto.addressId, dto.eventDate, dto.eventTimeStart];
    if (eventFields.some((value) => value !== undefined)) {
      if (
        !dto.addressId ||
        !dto.eventDate ||
        !dto.eventTimeStart ||
        !dto.guestCount
      ) {
        throw new BadRequestException(
          'Address, event date, time, and pax are required together',
        );
      }
      const event = await this.validateEventDetails(userId, dto);
      const updated = await this.prisma.cart.update({
        where: { id: cart.id },
        data: {
          addressId: dto.addressId,
          regionId: event.region.id,
          eventName: dto.eventName,
          eventDate: event.eventDate,
          eventTimeStart: event.eventTime,
          guestCount: dto.guestCount,
          distanceKm: event.distanceKm,
          deliveryFee: event.deliveryFee,
          specialNotes: dto.specialNotes,
          lastQuotedAt: null,
          expiresAt: this.expiryDate(),
        },
        include: this.cartInclude(),
      });
      return this.serializeCart(updated);
    }
    if (dto.guestCount !== undefined) {
      const version = await this.assertPackageVersion(dto.packageVersionId);
      if (
        dto.guestCount < version.minGuestCount ||
        (version.maxGuestCount && dto.guestCount > version.maxGuestCount)
      ) {
        throw new BadRequestException('Guest count is outside package limits');
      }
      const updated = await this.prisma.cart.update({
        where: { id: cart.id },
        data: {
          guestCount: dto.guestCount,
          lastQuotedAt: null,
          expiresAt: this.expiryDate(),
        },
        include: this.cartInclude(),
      });
      return this.serializeCart(updated);
    }
    if (dto.regionId !== undefined) {
      const updated = await this.updateRegion(userId, cart.id, dto.regionId);
      return updated;
    }
    return cart;
  }

  async create(userId: string, dto: CreateCartDto) {
    const version = await this.assertPackageVersion(dto.packageVersionId);
    const guestCount = dto.guestCount ?? version.minGuestCount;
    if (
      guestCount < version.minGuestCount ||
      (version.maxGuestCount && guestCount > version.maxGuestCount)
    ) {
      throw new BadRequestException('Guest count is outside package limits');
    }
    const cart = await this.prisma.cart.create({
      data: {
        userId,
        packageVersionId: dto.packageVersionId,
        regionId: await this.validRegionId(dto.regionId),
        guestCount,
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(cart);
  }

  async update(userId: string, id: string, dto: UpdateCartDto) {
    const cart = await this.assertActiveCart(userId, id);
    if (cart.packageVersionId !== dto.packageVersionId) {
      throw new BadRequestException('Package does not match this cart');
    }
    const eventFields = [dto.addressId, dto.eventDate, dto.eventTimeStart];
    if (eventFields.some((value) => value !== undefined)) {
      if (
        !dto.addressId ||
        !dto.eventDate ||
        !dto.eventTimeStart ||
        !dto.guestCount
      ) {
        throw new BadRequestException(
          'Address, event date, time, and pax are required together',
        );
      }
      const event = await this.validateEventDetails(userId, dto);
      const updated = await this.prisma.cart.update({
        where: { id },
        data: {
          addressId: dto.addressId,
          regionId: event.region.id,
          eventName: dto.eventName,
          eventDate: event.eventDate,
          eventTimeStart: event.eventTime,
          guestCount: dto.guestCount,
          distanceKm: event.distanceKm,
          deliveryFee: event.deliveryFee,
          specialNotes: dto.specialNotes,
          lastQuotedAt: null,
          expiresAt: this.expiryDate(),
        },
        include: this.cartInclude(),
      });
      return this.serializeCart(updated);
    }
    if (dto.guestCount !== undefined) {
      return this.updateQuantity(userId, id, dto.guestCount);
    }
    if (dto.regionId !== undefined) {
      return this.updateRegion(userId, id, dto.regionId);
    }
    return this.serializeCart(cart);
  }

  async getById(userId: string, id: string) {
    return this.serializeCart(await this.assertActiveCart(userId, id));
  }

  async clearActive(userId: string) {
    const carts = await this.prisma.cart.findMany({
      where: {
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      select: { id: true },
    });
    const ids = carts.map((cart) => cart.id);
    if (!ids.length) return { success: true, count: 0 };
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId: { in: ids } } }),
      this.prisma.cart.deleteMany({ where: { id: { in: ids } } }),
    ]);
    return { success: true, count: ids.length };
  }

  async replaceActiveItems(userId: string, dto: ReplaceCartItemsDto) {
    const cart = await this.requireActive(userId);
    return this.replaceItems(userId, cart.id, dto);
  }

  async quoteActive(userId: string) {
    const cart = await this.requireActive(userId);
    return this.quote(userId, cart.id);
  }

  async checkoutActive(userId: string) {
    const cart = await this.requireActive(userId);
    return this.checkout(userId, cart.id);
  }

  async getActive(userId: string) {
    const active = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      include: this.cartInclude(),
      orderBy: { updatedAt: 'desc' },
    });
    if (active) return this.serializeCart(active);
    const awaitingPayment = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.CHECKED_OUT,
        order: { orderStatus: OrderStatus.PENDING_PAYMENT },
      },
      include: this.cartInclude(),
      orderBy: { updatedAt: 'desc' },
    });
    return awaitingPayment ? this.serializeCart(awaitingPayment) : null;
  }

  async getAllActive(userId: string) {
    const carts = await this.prisma.cart.findMany({
      where: {
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      include: this.cartInclude(),
      orderBy: { updatedAt: 'desc' },
    });
    return carts.map((cart) => this.serializeCart(cart));
  }

  async updateQuantity(userId: string, id: string, guestCount: number) {
    const cart = await this.assertActiveCart(userId, id);
    const minimum = cart.packageVersion.minGuestCount;
    const maximum = cart.packageVersion.maxGuestCount;
    if (guestCount < minimum || (maximum && guestCount > maximum)) {
      throw new BadRequestException('Guest count is outside package limits');
    }
    const updated = await this.prisma.cart.update({
      where: { id },
      data: {
        guestCount,
        lastQuotedAt: null,
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(updated);
  }

  async removeActive(userId: string, id: string) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        id,
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
    });
    if (!cart) throw new NotFoundException('Active cart not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { cartId: id } });
      await tx.cart.delete({ where: { id } });
    });
    return { success: true, id };
  }

  async quoteAll(userId: string) {
    const carts = await this.prisma.cart.findMany({
      where: {
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!carts.length) throw new NotFoundException('Active cart not found');
    const quotes = await Promise.all(
      carts.map((cart) => this.quote(userId, cart.id)),
    );
    const subtotalAmount = quotes.reduce(
      (sum, quote) => sum.plus(quote.subtotalAmount),
      new Prisma.Decimal(0),
    );
    const deliveryFee = quotes.reduce(
      (sum, quote) => sum.plus(quote.deliveryFee),
      new Prisma.Decimal(0),
    );
    return {
      valid: true,
      carts: carts.map((cart, index) => ({ cartId: cart.id, quote: quotes[index] })),
      subtotalAmount: subtotalAmount.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      totalAmount: subtotalAmount.plus(deliveryFee).toFixed(2),
    };
  }

  async checkoutAll(userId: string) {
    const carts = await this.prisma.cart.findMany({
      where: {
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      include: this.cartInclude(),
      orderBy: { updatedAt: 'asc' },
    });
    if (!carts.length) throw new NotFoundException('Active cart not found');
    const incomplete = carts.find(
      (cart) =>
        !cart.addressId ||
        !cart.regionId ||
        !cart.eventDate ||
        !cart.eventTimeStart ||
        !cart.guestCount,
    );
    if (incomplete) {
      throw new BadRequestException(
        'Add event and venue details for every package before checkout',
      );
    }
    // Validate the full batch before creating the first order. Without this
    // preflight, a stale or invalid later cart could leave an earlier cart in
    // PENDING_PAYMENT with no complete payment batch to resume.
    await Promise.all(carts.map((cart) => this.quote(userId, cart.id)));
    const checkoutBatchId = randomUUID();
    const orders = [];
    for (const cart of carts) {
      orders.push(await this.checkout(userId, cart.id, checkoutBatchId));
    }
    return orders;
  }

  async createOrFetch(userId: string, dto: CreateCartDto) {
    await this.assertPackageVersion(dto.packageVersionId);
    const existing = await this.prisma.cart.findFirst({
      where: {
        userId,
        packageVersionId: dto.packageVersionId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      include: this.cartInclude(),
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      return this.serializeCart(existing);
    }

    const cart = await this.prisma.cart.create({
      data: {
        userId,
        packageVersionId: dto.packageVersionId,
        regionId: await this.validRegionId(dto.regionId),
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(cart);
  }

  async replaceItems(userId: string, id: string, dto: ReplaceCartItemsDto) {
    const cart = await this.assertActiveCart(userId, id);
    if (dto.items.length) {
      await this.validateCartItems(cart.packageVersionId, dto.items);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { cartId: id } });
      if (dto.items.length) {
        await tx.cartItem.createMany({
          data: dto.items.map((item) => ({
            cartId: id,
            categoryId: item.categoryId,
            menuItemId: item.menuItemId,
            replacedMenuItemId: item.replacedMenuItemId ?? null,
            role: item.role,
            quantity: item.quantity ?? 1,
          })),
        });
      }
      return tx.cart.update({
        where: { id },
        data: { lastQuotedAt: null, expiresAt: this.expiryDate() },
        include: this.cartInclude(),
      });
    });
    return this.serializeCart(updated);
  }

  async quote(userId: string, id: string) {
    const cart = await this.assertActiveCart(userId, id);
    const guestCount = cart.guestCount ?? cart.packageVersion.minGuestCount;
    const quote = await this.pricing.quote(
      cart.packageVersionId,
      guestCount,
      cart.items.map((item) => ({
        categoryId: item.categoryId,
        menuItemId: item.menuItemId,
        replacedMenuItemId: item.replacedMenuItemId,
        role: item.role,
        quantity: item.quantity,
      })),
    );
    await this.prisma.cart.update({
      where: { id },
      data: { lastQuotedAt: new Date() },
    });
    const serialized = this.pricing.serialize(quote);
    const deliveryFee = cart.deliveryFee.toFixed(2);
    return {
      valid: true,
      errors: [],
      ...serialized,
      region: cart.region ? this.regions.serialize(cart.region) : null,
      distanceKm: cart.distanceKm?.toFixed(2) ?? null,
      billableDistanceKm:
        cart.distanceKm === null ? null : Math.ceil(Number(cart.distanceKm)),
      deliveryFeePerKm: cart.region?.deliveryFeePerKm.toFixed(2) ?? null,
      deliveryFee,
      subtotalAmount: serialized.totalAmount,
      totalAmount: quote.totalAmount.plus(cart.deliveryFee).toFixed(2),
    };
  }

  async checkout(userId: string, id: string, checkoutBatchId?: string) {
    const cart = await this.assertActiveCart(userId, id);
    if (
      !cart.addressId ||
      !cart.eventDate ||
      !cart.eventTimeStart ||
      !cart.guestCount
    ) {
      throw new BadRequestException(
        'Add event and venue details before checkout',
      );
    }
    const order = await this.orders.create(
      userId,
      {
        selectedItems: cart.items.map((item) => ({
          categoryId: item.categoryId,
          menuItemId: item.menuItemId,
          replacedMenuItemId: item.replacedMenuItemId,
          role: item.role,
          quantity: item.quantity,
        })),
      },
      cart.id,
      checkoutBatchId,
    );
    await this.prisma.cart.update({
      where: { id },
      data: { status: CartStatus.CHECKED_OUT },
    });
    return order;
  }

  private async validateCartItems(
    packageVersionId: string,
    items: CartSelectionItemDto[],
  ) {
    const version = await this.assertPackageVersion(packageVersionId);
    const maxItemQuantity = Math.max(
      0,
      ...items.map((item) => item.quantity ?? 1),
    );
    const guestCount = Math.max(version.minGuestCount, maxItemQuantity);
    await this.pricing.quote(packageVersionId, guestCount, items);
  }

  private async assertActiveCart(userId: string, id: string) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        id,
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      include: this.cartInclude(),
    });
    if (!cart) throw new NotFoundException('Active cart not found');
    return cart;
  }

  private async requireActive(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!cart) throw new NotFoundException('Active cart not found');
    return cart;
  }

  private async assertPackageVersion(id: string) {
    const version = await this.prisma.packageVersion.findFirst({
      where: {
        id,
        isActive: true,
        publishedAt: { not: null },
        package: { isActive: true, deletedAt: null },
      },
      include: { package: true },
    });
    if (!version) throw new NotFoundException('Package version not found');
    return version;
  }

  private cartInclude() {
    return cartInclude;
  }

  private serializeCart(cart: CartWithDetails) {
    return {
      id: cart.id,
      userId: cart.userId,
      packageVersionId: cart.packageVersionId,
      guestCount: cart.guestCount,
      status: cart.status,
      expiresAt: cart.expiresAt?.toISOString() ?? null,
      lastQuotedAt: cart.lastQuotedAt?.toISOString() ?? null,
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
      pendingOrderId:
        cart.order?.orderStatus === OrderStatus.PENDING_PAYMENT
          ? cart.order.id
          : null,
      package: cart.packageVersion
        ? {
            id: cart.packageVersion.package.id,
            name: cart.packageVersion.package.name,
            type: cart.packageVersion.package.type,
            versionNo: cart.packageVersion.versionNo,
            basePricePerPlate:
              cart.packageVersion.basePricePerPlate instanceof Prisma.Decimal
                ? cart.packageVersion.basePricePerPlate.toFixed(2)
                : cart.packageVersion.basePricePerPlate,
            minGuestCount: cart.packageVersion.minGuestCount,
            maxGuestCount: cart.packageVersion.maxGuestCount,
          }
        : null,
      region: cart.region ? this.regions.serialize(cart.region) : null,
      event: cart.eventDate
        ? {
            eventName: cart.eventName,
            eventDate: cart.eventDate.toISOString().slice(0, 10),
            eventTimeStart:
              cart.eventTimeStart?.toISOString().slice(11, 16) ?? null,
            guestCount: cart.guestCount,
            address: cart.address,
            region: cart.region ? this.regions.serialize(cart.region) : null,
            distanceKm: cart.distanceKm?.toFixed?.(2) ?? null,
            deliveryFee: cart.deliveryFee?.toFixed?.(2) ?? '0.00',
          }
        : null,
      items: cart.items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        categoryName: item.category?.name,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem?.name,
        replacedMenuItemId: item.replacedMenuItemId,
        replacedMenuItemName: item.replacedMenuItem?.name ?? null,
        role: item.role,
        quantity: item.quantity,
        isVeg: item.menuItem?.isVeg,
      })),
    };
  }

  private expiryDate() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    return expiresAt;
  }

  private unexpiredCartScope() {
    return {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
  }

  private async validateEventDetails(userId: string, dto: UpdateCartDto) {
    const [address, version, settingRows] = await Promise.all([
      this.prisma.userAddress.findFirst({
        where: { id: dto.addressId!, userId },
      }),
      this.prisma.packageVersion.findFirst({
        where: {
          id: dto.packageVersionId,
          isActive: true,
          publishedAt: { not: null },
          package: { isActive: true, deletedAt: null },
        },
      }),
      this.prisma.platformSetting.findMany({
        where: {
          key: {
            in: [
              'min_booking_lead_hours',
              'event_service_start_time',
              'event_service_end_time',
              'event_time_interval_minutes',
            ],
          },
        },
      }),
    ]);
    if (!address)
      throw new BadRequestException('Address does not belong to customer');
    if (!version)
      throw new BadRequestException('Package version is not available');
    if (
      dto.guestCount! < version.minGuestCount ||
      (version.maxGuestCount && dto.guestCount! > version.maxGuestCount)
    ) {
      throw new BadRequestException('Guest count is outside package limits');
    }
    const eventDate = new Date(`${dto.eventDate}T00:00:00.000Z`);
    const eventInstant = eventLocalInstant(
      dto.eventDate!,
      dto.eventTimeStart!,
    );
    const settings = Object.fromEntries(
      settingRows.map((setting) => [setting.key, setting.value]),
    );
    const leadHours = nonNegativeIntegerSetting(
      settings.min_booking_lead_hours,
      48,
    );
    if (eventInstant.getTime() - Date.now() < leadHours * 3_600_000) {
      throw new BadRequestException(
        `Event requires at least ${leadHours} hours advance booking`,
      );
    }
    const startTime = settings.event_service_start_time ?? '06:00';
    const endTime = settings.event_service_end_time ?? '23:30';
    const interval = positiveIntegerSetting(
      settings.event_time_interval_minutes,
      30,
    );
    const selectedMinutes = clockMinutes(dto.eventTimeStart!)!;
    const startMinutes = clockMinutes(startTime);
    const endMinutes = clockMinutes(endTime);
    if (
      startMinutes === undefined ||
      endMinutes === undefined ||
      startMinutes >= endMinutes ||
      selectedMinutes < startMinutes ||
      selectedMinutes > endMinutes ||
      interval < 1 ||
      (selectedMinutes - startMinutes) % interval !== 0
    ) {
      throw new BadRequestException(
        `Choose an event time between ${startTime} and ${endTime} in ${interval}-minute intervals`,
      );
    }
    const eventTime = new Date(`1970-01-01T${dto.eventTimeStart}:00.000Z`);
    const assignment = dto.regionId
      ? await this.regions.assignToRegion(
          dto.regionId,
          address.latitude,
          address.longitude,
        )
      : await this.regions.assign(address.latitude, address.longitude);
    return { eventDate, eventTime, ...assignment };
  }

  private async validRegionId(regionId?: string) {
    if (!regionId) return undefined;
    const region = await this.prisma.operatingRegion.findFirst({
      where: { id: regionId, isActive: true },
      select: { id: true },
    });
    if (!region) {
      throw new BadRequestException(
        'Choose an available kitchen location before placing an order.',
      );
    }
    return region.id;
  }

  private async updateRegion(userId: string, id: string, regionId: string) {
    await this.assertActiveCart(userId, id);
    const updated = await this.prisma.cart.update({
      where: { id },
      data: {
        regionId: await this.validRegionId(regionId),
        lastQuotedAt: null,
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(updated);
  }
}
