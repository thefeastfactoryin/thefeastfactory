import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancellationActor,
  OrderStatus,
  PackageMenuItemRole,
  PackageType,
  PaymentStatus,
  Prisma,
  RefundStatus,
  SelectedItemRole,
} from '@prisma/client';
import type {
  OperatingRegion,
  Order,
  OrderSelectedItem,
  OrderCutleryItem,
  OrderStatusHistory,
  Payment,
  Refund,
  User,
  UserAddress,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { storedEventTime } from '../../common/event-time';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { CancelOrderDto } from './dto/cancel-order.dto';

type SerializableOrder = Order & {
  address?: UserAddress | null;
  region?: OperatingRegion | null;
  selectedItems?: OrderSelectedItem[];
  cutleryItems?: OrderCutleryItem[];
  payments?: Array<Payment & { refunds?: Refund[] }>;
  statusHistory?: OrderStatusHistory[];
  user?: User;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: OperatingRegionsService,
  ) {}

  async list(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        orderStatus: { not: OrderStatus.PENDING_PAYMENT },
      },
      include: {
        address: true,
        region: true,
        selectedItems: true,
        cutleryItems: true,
        payments: { include: { refunds: true } },
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
        cutleryItems: true,
        payments: { include: { refunds: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const serialized = this.serializeOrder(order);
    const sourceCartId = order.cartId ?? order.sourceCartId;
    if (!sourceCartId) return serialized;
    const cart = await this.prisma.cart.findUnique({
      where: { id: sourceCartId },
      include: {
        packageVersion: {
          include: {
            package: true,
            packageMenuItems: {
              where: {
                role: PackageMenuItemRole.INCLUDED,
                isAvailable: true,
              },
              include: { menuItem: true, category: true },
              orderBy: [{ displayOrder: 'asc' }, { menuItem: { name: 'asc' } }],
            },
          },
        },
      },
    });
    if (
      cart?.packageVersion.package.type !== PackageType.FIXED_PACKAGE &&
      cart?.packageVersion.package.type !== PackageType.MEAL_BOX
    ) {
      return serialized;
    }

    const selectedItems = serialized.selectedItems ?? [];
    const replacedIds = new Set(
      order.selectedItems
        ?.map((item) => item.replacedMenuItemId)
        .filter((item): item is string => Boolean(item)) ?? [],
    );
    const includedItems = cart.packageVersion.packageMenuItems
      .filter((row) => !replacedIds.has(row.menuItemId))
      .map((row) => ({
        id: `included:${row.id}`,
        orderId: order.id,
        categoryId: row.categoryId,
        menuItemId: row.menuItemId,
        replacedMenuItemId: null,
        role: SelectedItemRole.INCLUDED,
        quantity: order.guestCount ?? 1,
        menuItemName: row.menuItem.name,
        categoryName: row.category.name,
        replacedMenuItemName: null,
        isVeg: row.menuItem.isVeg,
        itemPrice: row.menuItem.generalPrice.toFixed(2),
        includedValue: row.menuItem.generalPrice.toFixed(2),
        adjustmentAmount: '0.00',
        totalAdjustmentAmount: '0.00',
        createdAt: order.createdAt,
      }));
    return {
      ...serialized,
      selectedItems: [...includedItems, ...selectedItems],
    };
  }

  async cancel(userId: string, id: string, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: order.bookingId, userId },
        include: { orders: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (
        booking.status === BookingStatus.CANCELLED ||
        booking.status === BookingStatus.COMPLETED ||
        booking.status === BookingStatus.DECLINED
      ) {
        throw new BadRequestException('Booking cannot be cancelled');
      }
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: {
            id: booking.id,
            userId,
            status: booking.status,
          },
          data: {
            status: BookingStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledBy: CancellationActor.CUSTOMER,
            cancellationReason: dto.reason,
          },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(
            'Booking status changed; reload before trying again',
          );
        }
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: BookingStatus.CANCELLED,
            notes: dto.reason,
          },
        });
        for (const child of booking.orders) {
          if (
            child.orderStatus === OrderStatus.CANCELLED ||
            child.orderStatus === OrderStatus.DELIVERED
          )
            continue;
          await tx.order.update({
            where: { id: child.id },
            data: {
              orderStatus: OrderStatus.CANCELLED,
              cancelledAt: new Date(),
              cancelledBy: CancellationActor.CUSTOMER,
              cancellationReason: dto.reason,
            },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: child.id,
              fromStatus: child.orderStatus,
              toStatus: OrderStatus.CANCELLED,
              notes: dto.reason,
            },
          });
        }
      });
      return this.get(userId, id);
    }
    if (
      order.orderStatus === OrderStatus.DELIVERED ||
      order.orderStatus === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Order cannot be cancelled');
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, userId, orderStatus: order.orderStatus },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationActor.CUSTOMER,
          cancellationReason: dto.reason,
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(
          'Order status changed; reload before trying again',
        );
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.orderStatus,
          toStatus: OrderStatus.CANCELLED,
          notes: dto.reason,
        },
      });
    });
    return this.get(userId, id);
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
      pricePerKg: item.pricePerKg?.toFixed(2) ?? null,
      lineTotal: item.lineTotal?.toFixed(2) ?? null,
      totalAdjustmentAmount:
        item.lineTotal?.toFixed(2) ??
        item.adjustmentAmount.mul(order.guestCount ?? 1).toFixed(2),
    }));
    const payments = order.payments?.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      bookingId: payment.bookingId,
      amount: payment.amount.toFixed(2),
      paymentStatus: payment.paymentStatus,
      source: payment.source,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      paymentMethod: payment.paymentMethod,
      externalReference: payment.externalReference,
      notes: payment.notes,
      paidAt: payment.paidAt,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      refunds: payment.refunds?.map((refund) => ({
        id: refund.id,
        paymentId: refund.paymentId,
        amount: refund.amount.toFixed(2),
        refundStatus: refund.refundStatus,
        razorpayRefundId: refund.razorpayRefundId,
        reason: refund.reason,
        initiatedAt: refund.initiatedAt,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt,
      })),
    }));
    const grossPaid = (order.payments ?? [])
      .filter(
        (payment) =>
          payment.paymentStatus === PaymentStatus.PAID ||
          payment.paymentStatus === PaymentStatus.REFUNDED,
      )
      .reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
    const refundedAmount = (order.payments ?? []).reduce(
      (sum, payment) =>
        sum.plus(
          (payment.refunds ?? [])
            .filter((refund) => refund.refundStatus === RefundStatus.SUCCESS)
            .reduce(
              (refundSum, refund) => refundSum.plus(refund.amount),
              new Prisma.Decimal(0),
            ),
        ),
      new Prisma.Decimal(0),
    );
    const amountPaid = Prisma.Decimal.max(
      grossPaid.minus(refundedAmount),
      new Prisma.Decimal(0),
    );
    const balanceDue = Prisma.Decimal.max(
      order.totalAmount.minus(amountPaid),
      new Prisma.Decimal(0),
    );
    const cutleryItems = order.cutleryItems?.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    }));
    const distanceKm = order.distanceKm?.toFixed(2) ?? null;
    const deliveryFee = order.deliveryFee.toFixed(2);
    return {
      ...order,
      contactNumber: order.contactNumber,
      basePerPlatePrice: order.basePerPlatePrice?.toFixed(2) ?? null,
      totalCustomizationCharges:
        order.totalCustomizationCharges?.toFixed(2) ?? null,
      finalPerPlatePrice: order.finalPerPlatePrice?.toFixed(2) ?? null,
      distanceKm,
      deliveryFee,
      cutleryIncludedCount: order.cutleryIncludedCount,
      cutleryExtraCount: order.cutleryExtraCount,
      cutleryUnitPrice: order.cutleryUnitPrice.toFixed(2),
      cutleryTotal: order.cutleryTotal.toFixed(2),
      totalAmount: order.totalAmount.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      refundedAmount: refundedAmount.toFixed(2),
      selectedItems,
      cutleryItems,
      payments,
      region,
      event: {
        eventName: order.eventName,
        eventDate: order.eventDate,
        eventTimeStart: order.eventTimeStart
          ? storedEventTime(order.eventTimeStart)
          : null,
        address: order.address,
        region,
        distanceKm,
        deliveryFee,
      },
    };
  }
}
