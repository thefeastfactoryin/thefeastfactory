import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  BookingFulfilmentStatus,
  BookingStatus,
  CancellationActor,
  OrderStatus,
  PaymentSource,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { AdminCancelOrderDto } from './dto/admin-cancel-order.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { DeclineOrderDto } from './dto/decline-order.dto';
import { RecordManualPaymentDto } from './dto/record-manual-payment.dto';
import { UpdateBookingFulfilmentDto } from './dto/update-booking-fulfilment.dto';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import { BookingsService } from '../bookings/bookings.service';

const fulfilmentOrderStatus: Record<BookingFulfilmentStatus, OrderStatus> = {
  NOT_STARTED: OrderStatus.CONFIRMED,
  PREPARING: OrderStatus.IN_PROGRESS,
  READY_FOR_DELIVERY: OrderStatus.READY_FOR_DELIVERY,
  OUT_FOR_DELIVERY: OrderStatus.OUT_FOR_DELIVERY,
  COMPLETED: OrderStatus.DELIVERED,
};

const fulfilmentSequence: BookingFulfilmentStatus[] = [
  BookingFulfilmentStatus.NOT_STARTED,
  BookingFulfilmentStatus.PREPARING,
  BookingFulfilmentStatus.READY_FOR_DELIVERY,
  BookingFulfilmentStatus.OUT_FOR_DELIVERY,
  BookingFulfilmentStatus.COMPLETED,
];

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly regions: OperatingRegionsService,
    private readonly bookings: BookingsService,
  ) {}

  async listBookings(admin: JwtPayload, query: AdminBookingsQueryDto) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      query.regionId,
    );
    return this.bookings.listAdmin(regionId, query);
  }

  async getBooking(admin: JwtPayload, id: string) {
    const regionId = await this.regions.resolveAdminScope(admin);
    return this.bookings.getAdmin(id, regionId);
  }

  async updateBookingFulfilment(
    admin: JwtPayload,
    id: string,
    dto: UpdateBookingFulfilmentDto,
  ) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const booking = await this.prisma.booking.findFirst({
      where: { id, ...(regionId ? { regionId } : {}) },
      include: { orders: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Approve the booking before updating fulfilment',
      );
    }
    if (booking.fulfilmentStatus === dto.status) {
      return this.getBooking(admin, id);
    }
    const currentStage = fulfilmentSequence.indexOf(booking.fulfilmentStatus);
    const requestedStage = fulfilmentSequence.indexOf(dto.status);
    if (requestedStage <= currentStage) {
      throw new BadRequestException('Fulfilment status can only move forward');
    }

    const nextBookingStatus =
      dto.status === BookingFulfilmentStatus.COMPLETED
        ? BookingStatus.COMPLETED
        : BookingStatus.CONFIRMED;
    const nextOrderStatus = fulfilmentOrderStatus[dto.status];
    const note =
      dto.notes?.trim() || `Booking fulfilment changed to ${dto.status}`;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: {
          id,
          status: booking.status,
          fulfilmentStatus: booking.fulfilmentStatus,
        },
        data: {
          fulfilmentStatus: dto.status,
          status: nextBookingStatus,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Booking fulfilment changed; reload before trying again',
        );
      }
      await tx.bookingFulfilmentHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.fulfilmentStatus,
          toStatus: dto.status,
          changedById: admin.sub,
          notes: note,
        },
      });
      if (booking.status !== nextBookingStatus) {
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: id,
            fromStatus: booking.status,
            toStatus: nextBookingStatus,
            changedById: admin.sub,
            notes: note,
          },
        });
      }

      for (const order of booking.orders) {
        if (
          order.orderStatus === OrderStatus.CANCELLED ||
          order.orderStatus === OrderStatus.DECLINED ||
          order.orderStatus === nextOrderStatus
        ) {
          continue;
        }
        await tx.order.update({
          where: { id: order.id },
          data: { orderStatus: nextOrderStatus },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.orderStatus,
            toStatus: nextOrderStatus,
            changedById: admin.sub,
            notes: `Synchronized from booking: ${note}`,
          },
        });
      }
    });
    return this.getBooking(admin, id);
  }

  async getOrder(admin: JwtPayload, bookingId: string, id: string) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const row = await this.prisma.order.findUnique({
      where: { id, bookingId },
      include: {
        user: true,
        address: true,
        region: true,
        selectedItems: true,
        cutleryItems: true,
        statusHistory: {
          include: {
            changedBy: { select: { id: true, name: true } },
          },
          orderBy: { changedAt: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Order not found');
    if (regionId && row.regionId !== regionId)
      throw new NotFoundException('Order not found');
    if (row.orderStatus === OrderStatus.PENDING_PAYMENT)
      throw new NotFoundException('Order not found');
    const serialized = this.orders.serializeOrder(row);
    if (!row.bookingId) throw new NotFoundException('Booking not found');
    const completeCustomerOrder = await this.orders.get(
      row.userId,
      row.bookingId,
      row.id,
    );
    return {
      ...serialized,
      selectedItems: completeCustomerOrder.selectedItems,
    };
  }

  async approveBooking(admin: JwtPayload, id: string) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const booking = await this.prisma.booking.findFirst({
      where: { id, ...(regionId ? { regionId } : {}) },
      include: { orders: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.AWAITING_APPROVAL) {
      throw new BadRequestException('This booking is not awaiting approval');
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id, status: BookingStatus.AWAITING_APPROVAL },
        data: {
          status: BookingStatus.CONFIRMED,
          declineReason: null,
          declinedAt: null,
        },
      });
      if (updated.count !== 1)
        throw new BadRequestException(
          'Booking status changed; reload before trying again',
        );
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: BookingStatus.AWAITING_APPROVAL,
          toStatus: BookingStatus.CONFIRMED,
          changedById: admin.sub,
          notes: 'Kitchen approved the booking',
        },
      });
      for (const order of booking.orders) {
        if (order.orderStatus !== OrderStatus.AWAITING_APPROVAL) continue;
        await tx.order.update({
          where: { id: order.id },
          data: { orderStatus: OrderStatus.CONFIRMED },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: OrderStatus.AWAITING_APPROVAL,
            toStatus: OrderStatus.CONFIRMED,
            changedById: admin.sub,
            notes: 'Kitchen approved the booking',
          },
        });
      }
    });
    return this.getBooking(admin, id);
  }

  async declineBooking(admin: JwtPayload, id: string, dto: DeclineOrderDto) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const booking = await this.prisma.booking.findFirst({
      where: { id, ...(regionId ? { regionId } : {}) },
      include: {
        orders: true,
        payments: { include: { refunds: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.AWAITING_APPROVAL) {
      throw new BadRequestException('This booking is not awaiting approval');
    }
    const paidPayments = booking.payments.filter(
      (payment) => payment.paymentStatus === PaymentStatus.PAID,
    );
    const refundRequired = paidPayments.length > 0;
    const reason = dto.reason.trim();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id, status: BookingStatus.AWAITING_APPROVAL },
        data: {
          status: BookingStatus.DECLINED,
          declineReason: reason,
          declinedAt: new Date(),
          paymentStatus: refundRequired
            ? PaymentStatus.REFUND_PENDING
            : PaymentStatus.UNPAID,
        },
      });
      if (updated.count !== 1)
        throw new BadRequestException(
          'Booking status changed; reload before trying again',
        );
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: BookingStatus.AWAITING_APPROVAL,
          toStatus: BookingStatus.DECLINED,
          changedById: admin.sub,
          notes: reason,
        },
      });
      for (const order of booking.orders) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            orderStatus: OrderStatus.DECLINED,
            declineReason: reason,
            declinedAt: new Date(),
            paymentStatus: refundRequired
              ? PaymentStatus.REFUND_PENDING
              : PaymentStatus.UNPAID,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.orderStatus,
            toStatus: OrderStatus.DECLINED,
            changedById: admin.sub,
            notes: reason,
          },
        });
      }
    });
    const manualRefundRequired = paidPayments.some(
      (payment) => payment.source === PaymentSource.MANUAL,
    );
    let automaticRefundFailed = false;
    for (const payment of paidPayments.filter(
      (entry) => entry.source === PaymentSource.RAZORPAY,
    )) {
      try {
        await this.payments.createRefund(admin.sub, payment.id, reason);
      } catch {
        automaticRefundFailed = true;
      }
    }
    if (automaticRefundFailed) {
      await this.prisma.booking.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.REFUND_FAILED },
      });
    }
    return {
      booking: await this.getBooking(admin, id),
      refundRequired,
      manualRefundRequired,
      automaticRefundFailed,
    };
  }

  async recordManualBookingPayment(
    admin: JwtPayload,
    id: string,
    dto: RecordManualPaymentDto,
  ) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const booking = await this.prisma.booking.findFirst({
      where: { id, ...(regionId ? { regionId } : {}) },
      select: { id: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.payments.recordManualBookingPayment(admin.sub, id, dto);
    return this.getBooking(admin, id);
  }

  async recordManualBookingRefund(
    admin: JwtPayload,
    bookingId: string,
    paymentId: string,
    dto: CreateRefundDto,
  ) {
    if (admin.role !== AdminRole.OPERATIONS) {
      throw new ForbiddenException(
        'Only kitchen Operations can confirm manual refunds',
      );
    }
    const regionId = await this.regions.resolveAdminScope(admin);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, ...(regionId ? { regionId } : {}) },
      select: { id: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.payments.recordManualRefund(
      admin.sub,
      bookingId,
      paymentId,
      dto.reason,
    );
    return this.getBooking(admin, bookingId);
  }

  async cancelBooking(admin: JwtPayload, id: string, dto: AdminCancelOrderDto) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const booking = await this.prisma.booking.findFirst({
      where: { id, ...(regionId ? { regionId } : {}) },
      include: { orders: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException('Booking cannot be cancelled');
    }
    if (booking.fulfilmentStatus !== BookingFulfilmentStatus.NOT_STARTED) {
      throw new BadRequestException(
        'Booking can only be cancelled before preparation starts',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id, status: booking.status },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationActor.ADMIN,
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
          bookingId: id,
          fromStatus: booking.status,
          toStatus: BookingStatus.CANCELLED,
          changedById: admin.sub,
          notes: dto.reason,
        },
      });
      for (const order of booking.orders) {
        if (
          order.orderStatus === OrderStatus.CANCELLED ||
          order.orderStatus === OrderStatus.DELIVERED
        )
          continue;
        await tx.order.update({
          where: { id: order.id },
          data: {
            orderStatus: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledBy: CancellationActor.ADMIN,
            cancelledByAdminId: admin.sub,
            cancellationReason: dto.reason,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.orderStatus,
            toStatus: OrderStatus.CANCELLED,
            changedById: admin.sub,
            notes: dto.reason,
          },
        });
      }
    });
    return this.getBooking(admin, id);
  }

  async listPayments(admin: JwtPayload, requestedRegionId?: string) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      requestedRegionId,
    );
    const rows = await this.prisma.payment.findMany({
      where: {
        booking: {
          ...(regionId ? { regionId } : {}),
          status: { not: BookingStatus.PENDING_PAYMENT },
        },
      },
      include: {
        booking: { include: { user: true, region: true } },
        refunds: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      ...row,
      amount: row.amount.toFixed(2),
      refunds: row.refunds.map((refund) => ({
        ...refund,
        amount: refund.amount.toFixed(2),
      })),
    }));
  }

  async refund(admin: JwtPayload, paymentId: string, dto: CreateRefundDto) {
    if (admin.role !== AdminRole.OPERATIONS) {
      throw new ForbiddenException(
        'Only kitchen Operations can process declined-order refunds',
      );
    }
    const regionId = await this.regions.resolveAdminScope(admin);
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!payment || !regionId || payment.booking.regionId !== regionId)
      throw new NotFoundException('Payment not found');
    return this.payments.createRefund(admin.sub, paymentId, dto.reason);
  }
}
