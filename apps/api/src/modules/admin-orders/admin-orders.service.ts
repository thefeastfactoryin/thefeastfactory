import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
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
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { DeclineOrderDto } from './dto/decline-order.dto';
import { RecordManualPaymentDto } from './dto/record-manual-payment.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
  PENDING_PAYMENT: [OrderStatus.CANCELLED],
  AWAITING_APPROVAL: [OrderStatus.CONFIRMED, OrderStatus.DECLINED],
  CONFIRMED: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
  IN_PROGRESS: [OrderStatus.READY_FOR_DELIVERY, OrderStatus.CANCELLED],
  READY_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],
  DECLINED: [],
  CANCELLED: [],
};

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly regions: OperatingRegionsService,
  ) {}

  async list(admin: JwtPayload, query: AdminOrdersQueryDto) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      query.regionId,
    );
    if (query.orderStatus === OrderStatus.PENDING_PAYMENT) {
      return {
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        totalPages: 1,
      };
    }
    const where = {
      ...(regionId ? { regionId } : {}),
      ...(query.orderStatus
        ? { orderStatus: query.orderStatus }
        : { orderStatus: { not: OrderStatus.PENDING_PAYMENT } }),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.mobileNumber
        ? {
            OR: [
              { contactNumber: { contains: query.mobileNumber } },
              { user: { mobileNumber: { contains: query.mobileNumber } } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            eventDate: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.city
        ? {
            address: {
              city: { contains: query.city, mode: 'insensitive' as const },
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          user: true,
          address: true,
          region: true,
          selectedItems: true,
          cutleryItems: true,
          payments: { include: { refunds: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.orders.serializeOrder(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async get(admin: JwtPayload, id: string) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        address: true,
        region: true,
        selectedItems: true,
        cutleryItems: true,
        payments: { include: { refunds: true } },
        statusHistory: {
          include: { changedBy: true },
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
    const completeCustomerOrder = await this.orders.get(row.userId, row.id);
    return {
      ...serialized,
      selectedItems: completeCustomerOrder.selectedItems,
    };
  }

  async updateStatus(admin: JwtPayload, id: string, dto: UpdateOrderStatusDto) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (regionId && order.regionId !== regionId)
      throw new NotFoundException('Order not found');
    if (!transitions[order.orderStatus].includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.orderStatus} to ${dto.status}`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, orderStatus: order.orderStatus },
        data: {
          orderStatus: dto.status,
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
          toStatus: dto.status,
          changedById: admin.sub,
          notes: dto.notes,
        },
      });
    });
    return this.get(admin, id);
  }

  async approve(admin: JwtPayload, id: string) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || (regionId && order.regionId !== regionId))
      throw new NotFoundException('Order not found');
    if (order.orderStatus !== OrderStatus.AWAITING_APPROVAL) {
      throw new BadRequestException('This booking is not awaiting approval');
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, orderStatus: OrderStatus.AWAITING_APPROVAL },
        data: {
          orderStatus: OrderStatus.CONFIRMED,
          declineReason: null,
          declinedAt: null,
        },
      });
      if (updated.count !== 1)
        throw new BadRequestException(
          'Booking status changed; reload before trying again',
        );
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: OrderStatus.AWAITING_APPROVAL,
          toStatus: OrderStatus.CONFIRMED,
          changedById: admin.sub,
          notes: 'Kitchen approved the booking',
        },
      });
    });
    return this.get(admin, id);
  }

  async decline(admin: JwtPayload, id: string, dto: DeclineOrderDto) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payments: { include: { refunds: true } } },
    });
    if (!order || (regionId && order.regionId !== regionId))
      throw new NotFoundException('Order not found');
    if (order.orderStatus !== OrderStatus.AWAITING_APPROVAL) {
      throw new BadRequestException('This booking is not awaiting approval');
    }
    const paidPayments = order.payments.filter(
      (payment) => payment.paymentStatus === PaymentStatus.PAID,
    );
    const refundRequired = paidPayments.length > 0;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, orderStatus: OrderStatus.AWAITING_APPROVAL },
        data: {
          orderStatus: OrderStatus.DECLINED,
          declineReason: dto.reason.trim(),
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
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: OrderStatus.AWAITING_APPROVAL,
          toStatus: OrderStatus.DECLINED,
          changedById: admin.sub,
          notes: dto.reason.trim(),
        },
      });
    });

    const manualRefundRequired = paidPayments.some(
      (payment) => payment.source === PaymentSource.MANUAL,
    );
    let automaticRefundFailed = false;
    for (const payment of paidPayments.filter(
      (entry) => entry.source === PaymentSource.RAZORPAY,
    )) {
      try {
        await this.payments.createRefund(admin.sub, payment.id, dto.reason);
      } catch {
        automaticRefundFailed = true;
      }
    }
    if (automaticRefundFailed) {
      await this.prisma.order.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.REFUND_FAILED },
      });
    }
    return {
      order: await this.get(admin, id),
      refundRequired,
      manualRefundRequired,
      automaticRefundFailed,
    };
  }

  async recordManualPayment(
    admin: JwtPayload,
    id: string,
    dto: RecordManualPaymentDto,
  ) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || (regionId && order.regionId !== regionId))
      throw new NotFoundException('Order not found');
    await this.payments.recordManualPayment(admin.sub, id, dto);
    return this.get(admin, id);
  }

  async cancel(admin: JwtPayload, id: string, dto: AdminCancelOrderDto) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (regionId && order.regionId !== regionId)
      throw new NotFoundException('Order not found');
    if (
      order.orderStatus === OrderStatus.CANCELLED ||
      order.orderStatus === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException('Order cannot be cancelled');
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, orderStatus: order.orderStatus },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationActor.ADMIN,
          cancelledByAdminId: admin.sub,
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
          changedById: admin.sub,
          notes: dto.reason,
        },
      });
    });
    return this.get(admin, id);
  }

  async listPayments(admin: JwtPayload, requestedRegionId?: string) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      requestedRegionId,
    );
    const rows = await this.prisma.payment.findMany({
      where: {
        order: {
          ...(regionId ? { regionId } : {}),
          orderStatus: { not: OrderStatus.PENDING_PAYMENT },
        },
      },
      include: {
        order: { include: { user: true, region: true } },
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
      include: { order: true },
    });
    if (!payment || !regionId || payment.order.regionId !== regionId)
      throw new NotFoundException('Payment not found');
    return this.payments.createRefund(admin.sub, paymentId, dto.reason);
  }
}
