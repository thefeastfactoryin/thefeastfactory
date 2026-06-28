import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CancellationActor,
  CartStatus,
  OrderStatus,
} from '@prisma/client';
import type {
  OperatingRegion,
  Order,
  OrderSelectedItem,
  OrderStatusHistory,
  Payment,
  Refund,
  User,
  UserAddress,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { PricingService } from '../pricing/pricing.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderSelectionDto } from './dto/order-selection.dto';

type SerializableOrder = Order & {
  address?: UserAddress | null;
  region?: OperatingRegion | null;
  selectedItems?: OrderSelectedItem[];
  payments?: Array<Payment & { refunds?: Refund[] }>;
  statusHistory?: OrderStatusHistory[];
  user?: User;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly regions: OperatingRegionsService,
  ) {}

  async create(userId: string, dto: OrderSelectionDto, cartId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, userId, status: CartStatus.ACTIVE },
      include: { address: true, region: true, order: true },
    });
    if (!cart || !cart.address || !cart.eventDate || !cart.eventTimeStart || !cart.guestCount) {
      throw new BadRequestException('Complete event and venue details before checkout');
    }
    const existingOrder = cart.order;
    if (existingOrder?.orderStatus === OrderStatus.PENDING_PAYMENT) {
      return this.get(userId, existingOrder.id);
    }
    if (existingOrder)
      throw new BadRequestException('An order already exists for this cart');
    const menuQuote = await this.pricing.quote(
      cart.packageVersionId,
      cart.guestCount,
      dto.selectedItems,
    );
    const assignment =
      cart.region && cart.distanceKm !== null
        ? {
            region: cart.region,
            distanceKm: cart.distanceKm,
            deliveryFee: cart.deliveryFee,
          }
        : await this.regions.assign(cart.address.latitude, cart.address.longitude);
    const totalAmount = menuQuote.totalAmount.plus(assignment.deliveryFee);
    const eventDate = cart.eventDate;
    const addressId = cart.addressId!;
    const eventInstant = new Date(eventDate);
    eventInstant.setUTCHours(cart.eventTimeStart.getUTCHours(), cart.eventTimeStart.getUTCMinutes(), 0, 0);
    const leadHours = Math.floor((eventInstant.getTime() - Date.now()) / 3_600_000);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: this.orderNumber(),
          userId,
          cartId,
          regionId: assignment.region.id,
          addressId,
          eventName: cart.eventName,
          eventDate,
          eventTimeStart: cart.eventTimeStart,
          specialNotes: cart.specialNotes,
          guestCount: menuQuote.guestCount,
          basePerPlatePrice: menuQuote.basePerPlatePrice,
          totalCustomizationCharges: menuQuote.totalCustomizationCharges,
          finalPerPlatePrice: menuQuote.finalPerPlatePrice,
          totalAmount,
          distanceKm: assignment.distanceKm,
          deliveryFee: assignment.deliveryFee,
          packageName: menuQuote.packageName,
          packageVersionNo: menuQuote.packageVersionNo,
          orderStatus: OrderStatus.PENDING_PAYMENT,
          bookingLeadHours: leadHours,
          selectedItems: {
            create: menuQuote.items.map((item) => ({
              categoryId: item.categoryId,
              menuItemId: item.menuItemId,
              replacedMenuItemId: item.replacedMenuItemId ?? null,
              role: item.role,
              menuItemName: item.menuItemName,
              categoryName: item.categoryName,
              replacedMenuItemName: item.replacedMenuItemName ?? null,
              isVeg: item.isVeg,
              itemPrice: item.itemPrice,
              includedValue: item.includedValue,
              adjustmentAmount: item.adjustmentAmount,
            })),
          },
          statusHistory: {
            create: {
              toStatus: OrderStatus.PENDING_PAYMENT,
              notes: 'Order created',
            },
          },
        },
        include: { selectedItems: true, statusHistory: true, region: true, address: true },
      });
      return this.serializeOrder(order);
    });
  }

  async list(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        address: true,
        region: true,
        selectedItems: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.serializeOrder(order));
  }

  async get(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        address: true,
        region: true,
        selectedItems: true,
        payments: { include: { refunds: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.serializeOrder(order);
  }

  async cancel(userId: string, id: string, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.orderStatus === OrderStatus.DELIVERED ||
      order.orderStatus === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Order cannot be cancelled');
    }
    const updated = await this.prisma.order.update({
        where: { id },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationActor.CUSTOMER,
          cancellationReason: dto.reason,
          statusHistory: {
            create: {
              fromStatus: order.orderStatus,
              toStatus: OrderStatus.CANCELLED,
              notes: dto.reason,
            },
          },
        },
        include: { selectedItems: true, payments: true, statusHistory: true },
      });
    return this.serializeOrder(updated);
  }

  private orderNumber() {
    const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
    return `ORD-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  serializeOrder(order: SerializableOrder) {
    const region = order.region ? this.regions.serialize(order.region) : null;
    const selectedItems = order.selectedItems?.map((item) => ({
        ...item,
        itemPrice: item.itemPrice.toFixed(2),
        includedValue: item.includedValue.toFixed(2),
        adjustmentAmount: item.adjustmentAmount.toFixed(2),
      }));
    const payments = order.payments?.map((payment) => ({
        ...payment,
        amount: payment.amount.toFixed(2),
        refunds: payment.refunds?.map((refund) => ({
          ...refund,
          amount: refund.amount.toFixed(2),
        })),
      }));
    const distanceKm = order.distanceKm?.toFixed(2) ?? null;
    const deliveryFee = order.deliveryFee.toFixed(2);
    return {
      ...order,
      basePerPlatePrice: order.basePerPlatePrice.toFixed(2),
      totalCustomizationCharges: order.totalCustomizationCharges.toFixed(2),
      finalPerPlatePrice: order.finalPerPlatePrice.toFixed(2),
      distanceKm,
      deliveryFee,
      totalAmount: order.totalAmount.toFixed(2),
      selectedItems,
      payments,
      region,
      event: {
        eventName: order.eventName,
        eventDate: order.eventDate,
        eventTimeStart: order.eventTimeStart,
        address: order.address,
        region,
        distanceKm,
        deliveryFee,
      },
    };
  }
}
