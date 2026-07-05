import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
    const cart = await this.createOrFetch(userId, { packageVersionId: dto.packageVersionId });
    const eventFields = [dto.addressId, dto.eventDate, dto.eventTimeStart, dto.guestCount];
    if (eventFields.some((value) => value !== undefined)) {
      if (!dto.addressId || !dto.eventDate || !dto.eventTimeStart || !dto.guestCount) {
        throw new BadRequestException('Address, event date, time, and pax are required together');
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
    return cart;
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
      where: { userId, status: CartStatus.ACTIVE },
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

  async createOrFetch(userId: string, dto: CreateCartDto) {
    await this.assertPackageVersion(dto.packageVersionId);
    await this.prisma.cart.updateMany({
      where: {
        userId,
        status: CartStatus.ACTIVE,
        packageVersionId: { not: dto.packageVersionId },
      },
      data: { status: CartStatus.ABANDONED },
    });
    const existing = await this.prisma.cart.findFirst({
      where: {
        userId,
        packageVersionId: dto.packageVersionId,
        status: CartStatus.ACTIVE,
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
    const guestCount =
      cart.guestCount ?? cart.packageVersion.minGuestCount;
    const quote = await this.pricing.quote(
      cart.packageVersionId,
      guestCount,
      cart.items.map((item) => ({
        categoryId: item.categoryId,
        menuItemId: item.menuItemId,
        replacedMenuItemId: item.replacedMenuItemId,
        role: item.role,
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

  async checkout(userId: string, id: string) {
    const cart = await this.assertActiveCart(userId, id);
    if (!cart.addressId || !cart.eventDate || !cart.eventTimeStart || !cart.guestCount) {
      throw new BadRequestException('Add event and venue details before checkout');
    }
    const order = await this.orders.create(
      userId,
      {
        selectedItems: cart.items.map((item) => ({
          categoryId: item.categoryId,
          menuItemId: item.menuItemId,
          replacedMenuItemId: item.replacedMenuItemId,
          role: item.role,
        })),
      },
      cart.id,
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
    const guestCount = version.minGuestCount;
    await this.pricing.quote(packageVersionId, guestCount, items);
  }

  private async assertActiveCart(userId: string, id: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { id, userId, status: CartStatus.ACTIVE },
      include: this.cartInclude(),
    });
    if (!cart) throw new NotFoundException('Active cart not found');
    return cart;
  }

  private async requireActive(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId, status: CartStatus.ACTIVE },
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
      event: cart.eventDate
        ? {
            eventName: cart.eventName,
            eventDate: cart.eventDate.toISOString().slice(0, 10),
            eventTimeStart: cart.eventTimeStart?.toISOString().slice(11, 16) ?? null,
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

  private async validateEventDetails(userId: string, dto: UpdateCartDto) {
    const [address, version, settingRows] = await Promise.all([
      this.prisma.userAddress.findFirst({ where: { id: dto.addressId!, userId } }),
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
    if (!address) throw new BadRequestException('Address does not belong to customer');
    if (!version) throw new BadRequestException('Package version is not available');
    if (
      dto.guestCount! < version.minGuestCount ||
      (version.maxGuestCount && dto.guestCount! > version.maxGuestCount)
    ) {
      throw new BadRequestException('Guest count is outside package limits');
    }
    const eventDate = new Date(`${dto.eventDate}T00:00:00.000Z`);
    const eventInstant = new Date(`${dto.eventDate}T${dto.eventTimeStart}:00.000Z`);
    const settings = Object.fromEntries(
      settingRows.map((setting) => [setting.key, setting.value]),
    );
    const leadHours = Number.parseInt(
      settings.min_booking_lead_hours ?? '48',
      10,
    );
    if (eventInstant.getTime() - Date.now() < leadHours * 3_600_000) {
      throw new BadRequestException(`Event requires at least ${leadHours} hours advance booking`);
    }
    const startTime = settings.event_service_start_time ?? '06:00';
    const endTime = settings.event_service_end_time ?? '23:30';
    const interval = Number.parseInt(
      settings.event_time_interval_minutes ?? '30',
      10,
    );
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const selectedMinutes = toMinutes(dto.eventTimeStart!);
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (
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
    const assignment = await this.regions.assign(address.latitude, address.longitude);
    return { eventDate, eventTime, ...assignment };
  }
}
