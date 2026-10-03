import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  CartStatus,
  DeliveryServiceType,
  OrderStatus,
  PackageType,
  Prisma,
  SelectedItemRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { eventLocalInstant } from '../../common/event-time';
import {
  clockMinutes,
  positiveIntegerSetting,
} from '../../common/setting-values';
import { OrdersService } from '../orders/orders.service';
import { cartFingerprint, type CheckoutSnapshot } from './checkout-snapshot';
import { PricingService } from '../pricing/pricing.service';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { CutleryService } from '../cutlery/cutlery.service';
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
  cutleryItems: {
    include: { cutleryItem: true },
    orderBy: { createdAt: 'asc' },
  },
});
type CartWithDetails = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
const CUTLERY_UNIT_PRICE = new Prisma.Decimal('5.00');
const CART_RETENTION_DAYS = 30;
const CART_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CART_CLEANUP_BATCH_SIZE = 500;

@Injectable()
export class CartService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CartService.name);
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly orders: OrdersService,
    private readonly regions: OperatingRegionsService,
    @Optional() private readonly cutlery?: CutleryService,
  ) {}

  onModuleInit() {
    void this.purgeExpiredCarts();
    this.cleanupTimer = setInterval(
      () => void this.purgeExpiredCarts(),
      CART_CLEANUP_INTERVAL_MS,
    );
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async purgeExpiredCarts() {
    const retentionCutoff = new Date(
      Date.now() - CART_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    let deletedCount = 0;
    try {
      while (true) {
        const staleCarts = await this.prisma.cart.findMany({
          where: {
            status: {
              in: [CartStatus.ABANDONED, CartStatus.EXPIRED],
            },
            expiresAt: { lt: new Date() },
            updatedAt: { lt: retentionCutoff },
            order: { is: null },
          },
          select: { id: true },
          take: CART_CLEANUP_BATCH_SIZE,
        });
        if (!staleCarts.length) break;
        const ids = staleCarts.map((cart) => cart.id);
        const deleted = await this.prisma.$transaction(async (tx) => {
          await tx.cartItem.deleteMany({ where: { cartId: { in: ids } } });
          return tx.cart.deleteMany({
            where: { id: { in: ids }, order: { is: null } },
          });
        });
        deletedCount += deleted.count;
        if (staleCarts.length < CART_CLEANUP_BATCH_SIZE) break;
      }
      if (deletedCount > 0) {
        this.logger.log(`Purged ${deletedCount} expired carts`);
      }
      return deletedCount;
    } catch (error) {
      this.logger.error(
        'Expired cart cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    }
  }

  async upsert(userId: string, dto: UpdateCartDto) {
    const version = await this.assertPackageVersion(dto.packageVersionId);
    const isKg = version.package.type === PackageType.ORDER_BY_KG;
    if (isKg) dto = { ...dto, guestCount: undefined };
    const cart = await this.createOrFetch(userId, {
      packageVersionId: dto.packageVersionId,
      regionId: dto.regionId,
    });
    const eventFields = [dto.eventDate, dto.eventTimeStart];
    if (eventFields.some((value) => value !== undefined)) {
      if (
        !dto.addressId ||
        !dto.eventDate ||
        !dto.eventTimeStart ||
        (!isKg && !dto.guestCount)
      ) {
        throw new BadRequestException(
          'Address, event date, time, and pax are required together',
        );
      }
      const event = await this.validateEventDetails(
        userId,
        dto,
        cart.deliveryServiceType,
        cart.helperCount,
      );
      const updated = await this.prisma.cart.update({
        where: { id: cart.id },
        data: {
          addressId: dto.addressId,
          regionId: event.region.id,
          eventName: dto.eventName,
          eventDate: event.eventDate,
          eventTimeStart: event.eventTime,
          guestCount: isKg ? null : dto.guestCount,
          cutleryIncludedCount: this.includedCutleryCount(
            version.package.type,
            isKg ? null : dto.guestCount,
          ),
          distanceKm: event.distanceKm,
          deliveryFee: event.deliveryFee,
          deliveryServiceType: event.deliveryServiceType,
          helperCount: event.helperCount,
          contactNumber: dto.contactNumber ?? cart.contactNumber,
          specialNotes: dto.specialNotes,
          lastQuotedAt: null,
          expiresAt: this.expiryDate(),
        },
        include: this.cartInclude(),
      });
      return this.serializeCart(updated);
    }
    if (dto.addressId !== undefined) {
      return this.updateAddress(userId, cart.id, dto.addressId, dto.regionId);
    }
    if (dto.guestCount !== undefined) {
      if (
        dto.guestCount < version.minGuestCount ||
        (version.maxGuestCount && dto.guestCount > version.maxGuestCount)
      ) {
        throw new BadRequestException('Guest count is outside package limits');
      }
      const updated = await this.prisma.cart.update({
        where: { id: cart.id },
        data: {
          guestCount: isKg ? null : dto.guestCount,
          cutleryIncludedCount: this.includedCutleryCount(
            version.package.type,
            isKg ? null : dto.guestCount,
          ),
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
    if (dto.cutleryExtraCount !== undefined) {
      return this.updateCutlery(userId, cart.id, dto.cutleryExtraCount);
    }
    if (dto.contactNumber !== undefined) {
      return this.updateContactNumber(userId, cart.id, dto.contactNumber);
    }
    return cart;
  }

  async create(userId: string, dto: CreateCartDto) {
    const version = await this.assertPackageVersion(dto.packageVersionId);
    const isKg = version.package.type === PackageType.ORDER_BY_KG;
    if (isKg && dto.regionId) {
      await this.assertKgRegionAvailability(version.package.id, dto.regionId);
    }
    const guestCount = isKg ? null : (dto.guestCount ?? version.minGuestCount);
    if (
      !isKg &&
      (guestCount! < version.minGuestCount ||
        (version.maxGuestCount && guestCount! > version.maxGuestCount))
    ) {
      throw new BadRequestException('Guest count is outside package limits');
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mobileNumber: true },
    });
    const cart = await this.prisma.cart.create({
      data: {
        userId,
        packageVersionId: dto.packageVersionId,
        regionId: await this.validRegionId(dto.regionId),
        guestCount,
        cutleryIncludedCount: this.includedCutleryCount(
          version.package.type,
          guestCount,
        ),
        cutleryUnitPrice: CUTLERY_UNIT_PRICE,
        contactNumber: user.mobileNumber,
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(cart);
  }

  async update(userId: string, id: string, dto: UpdateCartDto) {
    const cart = await this.assertActiveCart(userId, id);
    const isKg = cart.packageVersion.package.type === PackageType.ORDER_BY_KG;
    if (isKg) dto = { ...dto, guestCount: undefined };
    if (cart.packageVersionId !== dto.packageVersionId) {
      throw new BadRequestException('Package does not match this cart');
    }
    const eventFields = [dto.eventDate, dto.eventTimeStart];
    if (eventFields.some((value) => value !== undefined)) {
      if (
        !dto.addressId ||
        !dto.eventDate ||
        !dto.eventTimeStart ||
        (!isKg && !dto.guestCount)
      ) {
        throw new BadRequestException(
          'Address, event date, time, and pax are required together',
        );
      }
      const event = await this.validateEventDetails(
        userId,
        dto,
        cart.deliveryServiceType,
        cart.helperCount,
      );
      const updated = await this.prisma.cart.update({
        where: { id },
        data: {
          addressId: dto.addressId,
          regionId: event.region.id,
          eventName: dto.eventName,
          eventDate: event.eventDate,
          eventTimeStart: event.eventTime,
          guestCount: isKg ? null : dto.guestCount,
          cutleryIncludedCount: this.includedCutleryCount(
            cart.packageVersion.package.type,
            isKg ? null : dto.guestCount,
          ),
          distanceKm: event.distanceKm,
          deliveryFee: event.deliveryFee,
          deliveryServiceType: event.deliveryServiceType,
          helperCount: event.helperCount,
          contactNumber: dto.contactNumber ?? cart.contactNumber,
          specialNotes: dto.specialNotes,
          lastQuotedAt: null,
          expiresAt: this.expiryDate(),
        },
        include: this.cartInclude(),
      });
      return this.serializeCart(updated);
    }
    if (dto.addressId !== undefined) {
      return this.updateAddress(
        userId,
        id,
        dto.addressId,
        dto.regionId,
        cart.deliveryServiceType,
        cart.helperCount,
      );
    }
    if (dto.guestCount !== undefined) {
      return this.updateQuantity(userId, id, dto.guestCount);
    }
    if (dto.regionId !== undefined) {
      return this.updateRegion(userId, id, dto.regionId);
    }
    if (
      dto.deliveryServiceType !== undefined ||
      dto.helperCount !== undefined
    ) {
      return this.updateDeliveryService(
        userId,
        id,
        dto.deliveryServiceType ?? cart.deliveryServiceType,
        dto.helperCount ?? cart.helperCount,
      );
    }
    if (dto.cutleryExtraCount !== undefined) {
      return this.updateCutlery(userId, id, dto.cutleryExtraCount);
    }
    if (dto.contactNumber !== undefined) {
      return this.updateContactNumber(userId, id, dto.contactNumber);
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

  async checkoutActive(userId: string, specialNotes?: string) {
    const cart = await this.requireActive(userId);
    await this.saveCheckoutInstructions(userId, [cart.id], specialNotes);
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
    if (cart.packageVersion.package.type === PackageType.ORDER_BY_KG)
      throw new BadRequestException('Edit dish weights for kg orders');
    const minimum = cart.packageVersion.minGuestCount;
    const maximum = cart.packageVersion.maxGuestCount;
    if (guestCount < minimum || (maximum && guestCount > maximum)) {
      throw new BadRequestException('Guest count is outside package limits');
    }
    const updated = await this.prisma.cart.update({
      where: { id },
      data: {
        guestCount,
        cutleryIncludedCount: this.includedCutleryCount(
          cart.packageVersion.package.type,
          guestCount,
        ),
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
    const cutleryTotal = this.batchCutleryTotal(quotes);
    const deliveryFee = this.batchDeliveryFee(quotes);
    return {
      valid: true,
      carts: carts.map((cart, index) => ({
        cartId: cart.id,
        quote: quotes[index],
      })),
      subtotalAmount: subtotalAmount.toFixed(2),
      cutleryTotal: cutleryTotal.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      totalAmount: subtotalAmount
        .plus(cutleryTotal)
        .plus(deliveryFee)
        .toFixed(2),
    };
  }

  async checkoutAll(userId: string, specialNotes?: string) {
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
        !cart.contactNumber ||
        (!cart.guestCount &&
          cart.packageVersion.package.type !== PackageType.ORDER_BY_KG),
    );
    if (incomplete) {
      throw new BadRequestException(
        'Add event and venue details for every package before checkout',
      );
    }
    // Validate the full batch before creating the first order. Without this
    // preflight, a stale or invalid later cart could leave an earlier cart in
    // PENDING_PAYMENT with no complete payment batch to resume.
    const quotes = await Promise.all(
      carts.map((cart) => this.quote(userId, cart.id)),
    );
    await this.saveCheckoutInstructions(
      userId,
      carts.map((cart) => cart.id),
      specialNotes,
    );
    const checkoutBatchId = randomUUID();
    const deliveryFee = this.batchDeliveryFee(quotes);
    const cutleryOwnerCartId = this.bookingCutleryOwner(
      carts.map((cart, index) => ({ cartId: cart.id, quote: quotes[index] })),
    );
    const orders = [];
    for (const [index, cart] of carts.entries()) {
      orders.push(
        await this.checkout(
          userId,
          cart.id,
          checkoutBatchId,
          index === 0 ? deliveryFee : new Prisma.Decimal(0),
          cart.id === cutleryOwnerCartId ? undefined : 0,
        ),
      );
    }
    return orders;
  }

  async preparePayment(
    userId: string,
    specialNotes?: string,
  ): Promise<CheckoutSnapshot> {
    const initial = await this.prisma.cart.findMany({
      where: {
        userId,
        status: CartStatus.ACTIVE,
        ...this.unexpiredCartScope(),
      },
      include: this.cartInclude(),
      orderBy: { updatedAt: 'asc' },
    });
    if (!initial.length) throw new NotFoundException('Active cart not found');
    await this.saveCheckoutInstructions(
      userId,
      initial.map((cart) => cart.id),
      specialNotes,
    );
    const aggregate = await this.quoteAll(userId);
    const carts = await this.prisma.cart.findMany({
      where: {
        id: { in: initial.map((cart) => cart.id) },
        userId,
        status: CartStatus.ACTIVE,
      },
      include: this.cartInclude(),
    });
    if (
      carts.length !== initial.length ||
      aggregate.carts.length !== initial.length
    ) {
      throw new BadRequestException(
        'Your cart changed. Review it and try payment again.',
      );
    }
    const byId = new Map(carts.map((cart) => [cart.id, cart]));
    const sharedDeliveryFee = this.batchDeliveryFee(
      aggregate.carts.map((row) => row.quote),
    );
    const sharedCutleryTotal = this.batchCutleryTotal(
      aggregate.carts.map((row) => row.quote),
    );
    const cutleryOwnerCartId = this.bookingCutleryOwner(aggregate.carts);
    const cutleryOwnerQuote = aggregate.carts.find(
      (row) => row.cartId === cutleryOwnerCartId,
    );
    const sharedExtraCount = Math.max(
      0,
      cutleryOwnerQuote?.quote.cutleryExtraCount ?? 0,
    );
    const snapshots: CheckoutSnapshot['carts'] = [];

    for (const [index, original] of initial.entries()) {
      const cart = byId.get(original.id);
      const quote = aggregate.carts.find(
        (row) => row.cartId === original.id,
      )?.quote;
      if (
        !cart ||
        !quote ||
        !cart.addressId ||
        !cart.eventDate ||
        !cart.eventTimeStart ||
        !cart.contactNumber ||
        !quote.region?.id ||
        (!cart.guestCount &&
          cart.packageVersion.package.type !== PackageType.ORDER_BY_KG)
      ) {
        throw new BadRequestException(
          'Complete delivery details before payment.',
        );
      }
      const originalItems = cartFingerprint({
        ...original,
        specialNotes: cart.specialNotes,
      });
      if (originalItems !== cartFingerprint(cart)) {
        throw new BadRequestException(
          'Your cart changed. Review it and try payment again.',
        );
      }
      const selectedItems: CheckoutSnapshot['carts'][number]['selectedItems'] =
        quote.items.map((item) => ({
          categoryId: item.categoryId,
          menuItemId: item.menuItemId,
          replacedMenuItemId: item.replacedMenuItemId ?? null,
          role: item.role,
          quantity: item.quantity,
          weightGrams: item.weightGrams ?? null,
          pricePerKg: item.pricePerKg ?? null,
          lineTotal: item.lineTotal ?? null,
          menuItemName: item.menuItemName,
          categoryName: item.categoryName,
          replacedMenuItemName: item.replacedMenuItemName ?? null,
          isVeg: item.isVeg,
          itemPrice: item.itemPrice,
          includedValue: item.includedValue,
          adjustmentAmount: item.adjustmentAmount,
        }));
      if (cart.packageVersion.package.type === PackageType.FIXED_PACKAGE) {
        const replaced = new Set(
          selectedItems.map((item) => item.replacedMenuItemId),
        );
        const included = await this.prisma.packageMenuItem.findMany({
          where: {
            packageVersionId: cart.packageVersionId,
            role: 'INCLUDED',
            isAvailable: true,
            menuItemId: {
              notIn: [...replaced].filter((id): id is string => Boolean(id)),
            },
          },
          include: { menuItem: true, category: true },
        });
        selectedItems.push(
          ...included.map((row) => ({
            categoryId: row.categoryId,
            menuItemId: row.menuItemId,
            replacedMenuItemId: null,
            role: SelectedItemRole.INCLUDED,
            quantity: 1,
            weightGrams: null,
            pricePerKg: null,
            lineTotal: null,
            menuItemName: row.menuItem.name,
            categoryName: row.category.name,
            replacedMenuItemName: null,
            isVeg: row.menuItem.isVeg,
            itemPrice: row.menuItem.generalPrice.toFixed(2),
            includedValue: row.menuItem.generalPrice.toFixed(2),
            adjustmentAmount: '0.00',
          })),
        );
      }
      const deliveryFee =
        index === 0 ? sharedDeliveryFee : new Prisma.Decimal(0);
      const ownsBookingCutlery = cart.id === cutleryOwnerCartId;
      const cutleryTotal = ownsBookingCutlery
        ? sharedCutleryTotal
        : new Prisma.Decimal(0);
      snapshots.push({
        cartId: cart.id,
        cartFingerprint: cartFingerprint(cart),
        addressId: cart.addressId,
        regionId: quote.region.id,
        eventName: cart.eventName,
        eventDate: cart.eventDate.toISOString(),
        eventTimeStart: cart.eventTimeStart.toISOString(),
        specialNotes: cart.specialNotes,
        contactNumber: cart.contactNumber,
        packageType: cart.packageVersion.package.type,
        packageName: quote.packageName,
        packageImageUrl: cart.packageVersion.package.imageUrl ?? null,
        packageVersionNo: cart.packageVersion.versionNo,
        guestCount: quote.guestCount,
        basePerPlatePrice: quote.basePerPlatePrice,
        totalCustomizationCharges: quote.totalCustomizationCharges,
        finalPerPlatePrice: quote.finalPerPlatePrice,
        totalAmount: new Prisma.Decimal(quote.subtotalAmount)
          .plus(deliveryFee)
          .plus(cutleryTotal)
          .toFixed(2),
        distanceKm: quote.distanceKm,
        deliveryFee: deliveryFee.toFixed(2),
        deliveryServiceType: quote.deliveryServiceType,
        helperCount: quote.helperCount,
        cutleryIncludedCount: quote.cutleryIncludedCount,
        cutleryExtraCount: ownsBookingCutlery ? sharedExtraCount : 0,
        cutleryUnitPrice: quote.cutleryUnitPrice,
        cutleryTotal: cutleryTotal.toFixed(2),
        cutleryItems:
          ownsBookingCutlery
            ? (quote.cutleryItems ?? []).map((item) => ({
                itemId: item.id,
                itemName: item.name,
                unitLabel: item.unitLabel,
                includedQuantity: item.includedQuantity,
                extraQuantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
                imageUrl: item.imageUrl,
              }))
            : (quote.cutleryItems ?? []).map((item) => ({
                itemId: item.id,
                itemName: item.name,
                unitLabel: item.unitLabel,
                includedQuantity: item.includedQuantity,
                extraQuantity: 0,
                unitPrice: item.unitPrice,
                lineTotal: '0.00',
                imageUrl: item.imageUrl,
              })),
        selectedItems,
      });
    }
    return {
      carts: snapshots,
      totalAmount: snapshots
        .reduce(
          (sum, cart) => sum.plus(cart.totalAmount),
          new Prisma.Decimal(0),
        )
        .toFixed(2),
    };
  }

  private batchDeliveryFee(quotes: Array<{ deliveryFee: string }>) {
    return quotes.reduce((highest, quote) => {
      const fee = new Prisma.Decimal(quote.deliveryFee);
      return fee.greaterThan(highest) ? fee : highest;
    }, new Prisma.Decimal(0));
  }

  private batchCutleryTotal(quotes: Array<{ cutleryTotal?: string }>) {
    return quotes.reduce((highest, quote) => {
      const total = new Prisma.Decimal(quote.cutleryTotal ?? '0.00');
      return total.greaterThan(highest) ? total : highest;
    }, new Prisma.Decimal(0));
  }

  private bookingCutleryOwner(
    rows: Array<{ cartId: string; quote: { cutleryTotal?: string } }>,
  ) {
    return [...rows].sort((left, right) => {
      const amountDifference = new Prisma.Decimal(
        right.quote.cutleryTotal ?? '0.00',
      ).comparedTo(
        new Prisma.Decimal(left.quote.cutleryTotal ?? '0.00'),
      );
      return amountDifference || left.cartId.localeCompare(right.cartId);
    })[0]?.cartId;
  }

  private async saveCheckoutInstructions(
    userId: string,
    cartIds: string[],
    specialNotes?: string,
  ) {
    if (specialNotes === undefined) return;
    await this.prisma.cart.updateMany({
      where: {
        id: { in: cartIds },
        userId,
        status: CartStatus.ACTIVE,
      },
      data: { specialNotes: specialNotes.trim() || null },
    });
  }

  async createOrFetch(userId: string, dto: CreateCartDto) {
    const version = await this.assertPackageVersion(dto.packageVersionId);
    if (version.package.type === PackageType.ORDER_BY_KG && dto.regionId) {
      await this.assertKgRegionAvailability(version.package.id, dto.regionId);
    }
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

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mobileNumber: true },
    });
    const cart = await this.prisma.cart.create({
      data: {
        userId,
        packageVersionId: dto.packageVersionId,
        regionId: await this.validRegionId(dto.regionId),
        cutleryIncludedCount: this.includedCutleryCount(
          version.package.type,
          version.package.type === PackageType.ORDER_BY_KG
            ? null
            : version.minGuestCount,
        ),
        cutleryUnitPrice: CUTLERY_UNIT_PRICE,
        contactNumber: user.mobileNumber,
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(cart);
  }

  async replaceItems(userId: string, id: string, dto: ReplaceCartItemsDto) {
    const cart = await this.assertActiveCart(userId, id);
    if (dto.items.length) {
      await this.validateCartItems(
        cart.packageVersionId,
        dto.items,
        cart.regionId ?? undefined,
      );
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
            weightGrams: item.weightGrams ?? null,
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
    const assignment = cart.address
      ? await this.regions.assign(
          cart.address.latitude,
          cart.address.longitude,
          cart.deliveryServiceType,
          cart.helperCount,
        )
      : null;
    const guestCount = cart.guestCount ?? cart.packageVersion.minGuestCount;
    const legacyCutlery = this.cutleryForCart(cart, guestCount);
    const cutleryQuote = this.cutlery
      ? await this.cutlery.quote(cart.id)
      : { items: [], total: legacyCutlery.total };
    const cutleryIncludedCount = Math.max(
      legacyCutlery.includedCount,
      ...cutleryQuote.items.map((item) => item.includedQuantity),
    );
    const cutleryExtraCount = cutleryQuote.items.length
      ? cutleryQuote.items.reduce((sum, item) => sum + item.quantity, 0)
      : legacyCutlery.extraCount;
    const quote = await this.pricing.quote(
      cart.packageVersionId,
      guestCount,
      cart.items.map((item) => ({
        categoryId: item.categoryId,
        menuItemId: item.menuItemId,
        replacedMenuItemId: item.replacedMenuItemId,
        role: item.role,
        quantity: item.quantity,
        weightGrams: item.weightGrams,
      })),
      assignment?.region.id ?? cart.regionId ?? undefined,
    );
    await this.prisma.cart.update({
      where: { id },
      data: {
        lastQuotedAt: new Date(),
        ...(assignment
          ? {
              regionId: assignment.region.id,
              distanceKm: assignment.distanceKm,
              deliveryServiceType: assignment.deliveryServiceType,
              helperCount: assignment.helperCount,
              deliveryFee: assignment.deliveryFee,
            }
          : {}),
        cutleryIncludedCount,
      },
    });
    const serialized = this.pricing.serialize(quote);
    const region = assignment?.region ?? cart.region;
    const distanceKm = assignment?.distanceKm ?? cart.distanceKm;
    const deliveryFeeValue = assignment?.deliveryFee ?? cart.deliveryFee;
    const baseDeliveryFee = assignment?.baseDeliveryFee ?? deliveryFeeValue;
    const serviceAddon = assignment?.serviceAddon ?? new Prisma.Decimal(0);
    const deliveryFee = deliveryFeeValue.toFixed(2);
    return {
      valid: true,
      errors: [],
      ...serialized,
      region: region ? this.regions.serialize(region) : null,
      distanceKm: distanceKm?.toFixed(2) ?? null,
      billableDistanceKm:
        distanceKm === null ? null : Math.ceil(Number(distanceKm)),
      deliveryFeePerKm: region?.deliveryFeePerKm.toFixed(2) ?? null,
      deliveryFee,
      deliveryServiceType:
        assignment?.deliveryServiceType ?? cart.deliveryServiceType,
      helperCount: assignment?.helperCount ?? cart.helperCount,
      baseDeliveryFee: baseDeliveryFee.toFixed(2),
      serviceAddon: serviceAddon.toFixed(2),
      subtotalAmount: serialized.totalAmount,
      cutleryIncludedCount,
      cutleryExtraCount,
      cutleryUnitPrice: CUTLERY_UNIT_PRICE.toFixed(2),
      cutleryItems: cutleryQuote.items,
      cutleryTotal: cutleryQuote.total.toFixed(2),
      totalAmount: quote.totalAmount
        .plus(cutleryQuote.total)
        .plus(deliveryFeeValue)
        .toFixed(2),
    };
  }

  async checkout(
    userId: string,
    id: string,
    checkoutBatchId?: string,
    deliveryFeeOverride?: Prisma.Decimal,
    cutleryExtraCountOverride?: number,
  ) {
    const cart = await this.assertActiveCart(userId, id);
    if (
      !cart.addressId ||
      !cart.eventDate ||
      !cart.eventTimeStart ||
      !cart.contactNumber ||
      (!cart.guestCount &&
        cart.packageVersion.package.type !== PackageType.ORDER_BY_KG)
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
          weightGrams: item.weightGrams,
        })),
      },
      cart.id,
      checkoutBatchId,
      deliveryFeeOverride,
      cutleryExtraCountOverride,
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
    regionId?: string,
  ) {
    const version = await this.assertPackageVersion(packageVersionId);
    const maxItemQuantity = Math.max(
      0,
      ...items.map((item) => item.quantity ?? 1),
    );
    const guestCount = Math.max(version.minGuestCount, maxItemQuantity);
    await this.pricing.quote(packageVersionId, guestCount, items, regionId);
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
      paymentTryCount: cart.paymentTryCount,
      pendingOrderId:
        cart.order?.orderStatus === OrderStatus.PENDING_PAYMENT
          ? cart.order.id
          : null,
      specialNotes: cart.specialNotes,
      contactNumber: cart.contactNumber,
      deliveryServiceType: cart.deliveryServiceType,
      helperCount: cart.helperCount,
      cutleryIncludedCount:
        cart.cutleryIncludedCount ??
        this.includedCutleryCount(
          cart.packageVersion.package.type,
          cart.guestCount,
        ),
      cutleryExtraCount: cart.cutleryExtraCount ?? 0,
      cutleryUnitPrice: (cart.cutleryUnitPrice ?? CUTLERY_UNIT_PRICE).toFixed(
        2,
      ),
      cutleryItems: (cart.cutleryItems ?? []).map((row) => ({
        id: row.cutleryItem.id,
        name: row.cutleryItem.name,
        extraLabel: row.cutleryItem.extraLabel,
        description: row.cutleryItem.description,
        unitLabel: row.cutleryItem.unitLabel,
        unitPrice: row.cutleryItem.unitPrice.toFixed(2),
        includedQuantity: row.cutleryItem.includedQuantity,
        imageUrl: row.cutleryItem.imageUrl,
        displayOrder: row.cutleryItem.displayOrder,
        isActive: row.cutleryItem.isActive,
        quantity: row.quantity,
        lineTotal: row.cutleryItem.unitPrice.mul(row.quantity).toFixed(2),
      })),
      address: cart.address,
      package: cart.packageVersion
        ? {
            id: cart.packageVersion.package.id,
            name: cart.packageVersion.package.name,
            imageUrl: cart.packageVersion.package.imageUrl,
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
            cutleryIncludedCount:
              cart.cutleryIncludedCount ??
              this.includedCutleryCount(
                cart.packageVersion.package.type,
                cart.guestCount,
              ),
            cutleryExtraCount: cart.cutleryExtraCount ?? 0,
            cutleryUnitPrice: (
              cart.cutleryUnitPrice ?? CUTLERY_UNIT_PRICE
            ).toFixed(2),
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
        weightGrams: item.weightGrams,
        isVeg: item.menuItem?.isVeg,
      })),
    };
  }

  private expiryDate() {
    // An active cart ends only on successful payment or customer deletion.
    return null;
  }

  private unexpiredCartScope() {
    // Active carts remain available until the customer removes them or a
    // verified payment consumes them. An old expiry timestamp is not a reason
    // to hide a saved cart.
    return {};
  }

  private async validateEventDetails(
    userId: string,
    dto: UpdateCartDto,
    deliveryServiceType: DeliveryServiceType,
    helperCount: number,
  ) {
    const [address, version, settingRows] = await Promise.all([
      this.prisma.userAddress.findFirst({
        where: { id: dto.addressId!, userId, deletedAt: null },
      }),
      this.prisma.packageVersion.findFirst({
        include: { package: true },
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
      version.package.type !== PackageType.ORDER_BY_KG &&
      (dto.guestCount! < version.minGuestCount ||
        (version.maxGuestCount && dto.guestCount! > version.maxGuestCount))
    ) {
      throw new BadRequestException('Guest count is outside package limits');
    }
    const eventDate = new Date(`${dto.eventDate}T00:00:00.000Z`);
    const eventInstant = eventLocalInstant(dto.eventDate!, dto.eventTimeStart!);
    const settings = Object.fromEntries(
      settingRows.map((setting) => [setting.key, setting.value]),
    );
    const assignment = dto.regionId
      ? await this.regions.assignToRegion(
          dto.regionId,
          address.latitude,
          address.longitude,
          deliveryServiceType,
          helperCount,
        )
      : await this.regions.assign(
          address.latitude,
          address.longitude,
          deliveryServiceType,
          helperCount,
        );
    const leadHours = assignment.region.minBookingLeadHours;
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
    return { eventDate, eventTime, ...assignment };
  }

  private async validRegionId(regionId?: string) {
    if (!regionId) return undefined;
    const region = await this.prisma.operatingRegion.findFirst({
      where: { id: regionId, isActive: true, isAcceptingOrders: true },
      select: { id: true },
    });
    if (!region) {
      throw new BadRequestException(
        'Choose an available kitchen location before placing an order.',
      );
    }
    return region.id;
  }

  private async assertKgRegionAvailability(
    packageId: string,
    regionId: string,
  ) {
    const disabled = await this.prisma.packageRegionAvailability.findFirst({
      where: { packageId, regionId, isAvailable: false },
      select: { id: true },
    });
    if (disabled) {
      throw new BadRequestException(
        'Order by KG is currently unavailable at this location',
      );
    }
  }

  private async updateAddress(
    userId: string,
    cartId: string,
    addressId: string,
    regionId?: string,
    deliveryServiceType: DeliveryServiceType = DeliveryServiceType.STANDARD,
    helperCount = 0,
  ) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });
    if (!address) {
      throw new BadRequestException('Address does not belong to customer');
    }
    const assignment = regionId
      ? await this.regions.assignToRegion(
          regionId,
          address.latitude,
          address.longitude,
          deliveryServiceType,
          helperCount,
        )
      : await this.regions.assign(
          address.latitude,
          address.longitude,
          deliveryServiceType,
          helperCount,
        );
    const updated = await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        addressId,
        regionId: assignment.region.id,
        distanceKm: assignment.distanceKm,
        deliveryServiceType: assignment.deliveryServiceType,
        helperCount: assignment.helperCount,
        deliveryFee: assignment.deliveryFee,
        lastQuotedAt: null,
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(updated);
  }

  private async updateDeliveryService(
    userId: string,
    id: string,
    deliveryServiceType: DeliveryServiceType,
    helperCount: number,
  ) {
    const cart = await this.assertActiveCart(userId, id);
    const assignment = cart.address
      ? await this.regions.assign(
          cart.address.latitude,
          cart.address.longitude,
          deliveryServiceType,
          helperCount,
        )
      : null;
    const updated = await this.prisma.cart.update({
      where: { id },
      data: {
        deliveryServiceType,
        helperCount: assignment?.helperCount ?? helperCount,
        ...(assignment
          ? {
              regionId: assignment.region.id,
              distanceKm: assignment.distanceKm,
              deliveryFee: assignment.deliveryFee,
            }
          : {}),
        lastQuotedAt: null,
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(updated);
  }

  private async updateCutlery(
    userId: string,
    id: string,
    cutleryExtraCount: number,
  ) {
    if (cutleryExtraCount > 10000) {
      throw new BadRequestException('Cutlery count is too high');
    }
    await this.assertActiveCart(userId, id);
    const updated = await this.prisma.cart.update({
      where: { id },
      data: {
        cutleryExtraCount,
        cutleryUnitPrice: CUTLERY_UNIT_PRICE,
        lastQuotedAt: null,
        expiresAt: this.expiryDate(),
      },
      include: this.cartInclude(),
    });
    return this.serializeCart(updated);
  }

  private includedCutleryCount(
    packageType: PackageType,
    guestCount?: number | null,
  ) {
    if (packageType === PackageType.ORDER_BY_KG) return 0;
    return Math.max(0, guestCount ?? 0);
  }

  private cutleryForCart(cart: CartWithDetails, guestCount: number) {
    const includedCount = this.includedCutleryCount(
      cart.packageVersion.package?.type ?? PackageType.FIXED_PACKAGE,
      guestCount,
    );
    const extraCount = Math.max(0, cart.cutleryExtraCount ?? 0);
    const unitPrice = cart.cutleryUnitPrice ?? CUTLERY_UNIT_PRICE;
    return {
      includedCount,
      extraCount,
      unitPrice,
      total: unitPrice.mul(extraCount),
    };
  }

  private async updateContactNumber(
    userId: string,
    id: string,
    contactNumber: string,
  ) {
    await this.assertActiveCart(userId, id);
    const updated = await this.prisma.cart.update({
      where: { id },
      data: { contactNumber, expiresAt: this.expiryDate() },
      include: this.cartInclude(),
    });
    return this.serializeCart(updated);
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
