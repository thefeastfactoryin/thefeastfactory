import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancellationActor,
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { storedEventTime } from '../../common/event-time';
import { PrismaService } from '../../prisma/prisma.service';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { OrdersService } from '../orders/orders.service';

const bookingInclude = {
  user: true,
  address: true,
  region: true,
  cutleryItems: true,
  payments: {
    include: { refunds: true, allocations: true },
    orderBy: { createdAt: 'asc' },
  },
  orders: {
    include: {
      address: true,
      region: true,
      selectedItems: true,
      cutleryItems: true,
      payments: { include: { refunds: true } },
      statusHistory: { orderBy: { changedAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  },
  statusHistory: {
    include: {
      changedBy: { select: { id: true, name: true } },
    },
    orderBy: { changedAt: 'asc' },
  },
} satisfies Prisma.BookingInclude;

type BookingWithDetails = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly regions: OperatingRegionsService,
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.booking.findMany({
      where: {
        userId,
        status: { not: BookingStatus.PENDING_PAYMENT },
      },
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async get(userId: string, id: string) {
    const row = await this.prisma.booking.findFirst({
      where: { id, userId },
      include: bookingInclude,
    });
    if (!row) throw new NotFoundException('Booking not found');
    return this.serialize(row);
  }

  async listAdmin(
    regionId?: string,
    filters?: {
      status?: BookingStatus;
      paymentStatus?: PaymentStatus;
      mobileNumber?: string;
      dateFrom?: string;
      dateTo?: string;
      city?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const where: Prisma.BookingWhereInput = {
      ...(regionId ? { regionId } : {}),
      ...(filters?.status
        ? { status: filters.status }
        : { status: { not: BookingStatus.PENDING_PAYMENT } }),
      ...(filters?.paymentStatus
        ? { paymentStatus: filters.paymentStatus }
        : {}),
      ...(filters?.mobileNumber
        ? { contactNumber: { contains: filters.mobileNumber } }
        : {}),
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            eventDate: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters?.city
        ? { city: { contains: filters.city, mode: 'insensitive' } }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.serialize(row)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getAdmin(id: string, regionId?: string) {
    const row = await this.prisma.booking.findFirst({
      where: { id, ...(regionId ? { regionId } : {}) },
      include: bookingInclude,
    });
    if (!row) throw new NotFoundException('Booking not found');
    return this.serialize(row);
  }

  async getByOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { bookingId: true },
    });
    if (!order?.bookingId) throw new NotFoundException('Booking not found');
    return this.get(userId, order.bookingId);
  }

  async cancel(userId: string, id: string, reason?: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId },
      include: { orders: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.DECLINED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException('Booking cannot be cancelled');
    }
    const note = reason?.trim() || 'Cancelled by customer';
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id, userId, status: booking.status },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationActor.CUSTOMER,
          cancellationReason: note,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Booking status changed; reload before trying again',
        );
      }
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: BookingStatus.CANCELLED,
          notes: note,
        },
      });
      for (const order of booking.orders) {
        if (
          order.orderStatus === OrderStatus.CANCELLED ||
          order.orderStatus === OrderStatus.DELIVERED
        ) {
          continue;
        }
        await tx.order.update({
          where: { id: order.id },
          data: {
            orderStatus: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledBy: CancellationActor.CUSTOMER,
            cancellationReason: note,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.orderStatus,
            toStatus: OrderStatus.CANCELLED,
            notes: note,
          },
        });
      }
    });
    return this.get(userId, id);
  }

  serialize(booking: BookingWithDetails) {
    const payments = booking.payments.map((payment) => ({
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
      refunds: payment.refunds.map((refund) => ({
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
    const grossPaid = booking.payments
      .filter(
        (payment) =>
          payment.paymentStatus === PaymentStatus.PAID ||
          payment.paymentStatus === PaymentStatus.REFUNDED,
      )
      .reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
    const refunded = booking.payments.reduce(
      (sum, payment) =>
        sum.plus(
          payment.refunds
            .filter((refund) => refund.refundStatus === RefundStatus.SUCCESS)
            .reduce(
              (refundSum, refund) => refundSum.plus(refund.amount),
              new Prisma.Decimal(0),
            ),
        ),
      new Prisma.Decimal(0),
    );
    const amountPaid = Prisma.Decimal.max(
      grossPaid.minus(refunded),
      new Prisma.Decimal(0),
    );
    const balanceDue = Prisma.Decimal.max(
      booking.totalAmount.minus(amountPaid),
      new Prisma.Decimal(0),
    );
    const orderLedgers = new Map<
      string,
      { paid: Prisma.Decimal; refunded: Prisma.Decimal }
    >();
    for (const payment of booking.payments) {
      const countsAsCaptured =
        payment.paymentStatus === PaymentStatus.PAID ||
        payment.paymentStatus === PaymentStatus.REFUNDED;
      if (!countsAsCaptured || payment.amount.lte(0)) continue;
      const paymentRefunded = payment.refunds
        .filter((refund) => refund.refundStatus === RefundStatus.SUCCESS)
        .reduce(
          (sum, refund) => sum.plus(refund.amount),
          new Prisma.Decimal(0),
        );
      for (const allocation of payment.allocations) {
        const ledger = orderLedgers.get(allocation.orderId) ?? {
          paid: new Prisma.Decimal(0),
          refunded: new Prisma.Decimal(0),
        };
        const allocatedRefund = Prisma.Decimal.min(
          allocation.amount,
          paymentRefunded.mul(allocation.amount).div(payment.amount),
        );
        ledger.paid = ledger.paid.plus(
          allocation.amount.minus(allocatedRefund),
        );
        ledger.refunded = ledger.refunded.plus(allocatedRefund);
        orderLedgers.set(allocation.orderId, ledger);
      }
    }
    const region = booking.region
      ? this.regions.serialize(booking.region)
      : null;
    return {
      ...booking,
      distanceKm: booking.distanceKm?.toFixed(2) ?? null,
      deliveryFee: booking.deliveryFee.toFixed(2),
      itemsSubtotal: booking.itemsSubtotal.toFixed(2),
      cutleryTotal: booking.cutleryTotal.toFixed(2),
      totalAmount: booking.totalAmount.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      refundedAmount: refunded.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      payments,
      region,
      addressSnapshot: {
        label: booking.addressLabel,
        addressLine1: booking.addressLine1,
        addressLine2: booking.addressLine2,
        city: booking.city,
        state: booking.state,
        pincode: booking.pincode,
        landmark: booking.landmark,
        latitude: booking.latitude?.toFixed(8) ?? null,
        longitude: booking.longitude?.toFixed(8) ?? null,
      },
      event: {
        eventName: booking.eventName,
        eventDate: booking.eventDate,
        eventTimeStart: booking.eventTimeStart
          ? storedEventTime(booking.eventTimeStart)
          : null,
        region,
        distanceKm: booking.distanceKm?.toFixed(2) ?? null,
        deliveryFee: booking.deliveryFee.toFixed(2),
      },
      cutleryItems: booking.cutleryItems.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
      })),
      orders: booking.orders.map((order) => {
        const serialized = this.orders.serializeOrder(order);
        const ledger = orderLedgers.get(order.id) ?? {
          paid: new Prisma.Decimal(0),
          refunded: new Prisma.Decimal(0),
        };
        return {
          ...serialized,
          amountPaid: ledger.paid.toFixed(2),
          balanceDue: Prisma.Decimal.max(
            order.totalAmount.minus(ledger.paid),
            new Prisma.Decimal(0),
          ).toFixed(2),
          refundedAmount: ledger.refunded.toFixed(2),
        };
      }),
    };
  }
}
