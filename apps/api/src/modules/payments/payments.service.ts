import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationsService } from '../operations/operations.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

type GatewayPayment = {
  id: string;
  order_id?: string | null;
  amount: number;
  status: string;
  method?: string;
  error_description?: string;
};
export type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: GatewayPayment };
    refund?: {
      entity?: { id?: string; status?: string; payment_id?: string };
    };
  };
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly operations: OperationsService,
  ) {}

  async createGatewayOrder(userId: string, orderId: string) {
    this.assertPaymentModeAvailable();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.orderStatus !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Order is not awaiting payment');
    }
    const currency = await this.currency();

    const existing = order.payments.find(
      (payment) =>
        payment.paymentStatus === PaymentStatus.PENDING &&
        payment.razorpayOrderId,
    );
    if (existing) {
      const linkedPayments = await this.prisma.payment.findMany({
        where: {
          razorpayOrderId: existing.razorpayOrderId,
          paymentStatus: PaymentStatus.PENDING,
          order: { userId },
        },
      });
      const linkedAmount = linkedPayments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
      const amount = this.paymentAmountInSubunits(linkedAmount);
      return {
        paymentId: existing.id,
        keyId: this.keyId() || 'local',
        id: existing.razorpayOrderId,
        amount,
        currency,
        localMode: !this.isConfigured(),
        reused: true,
      };
    }

    const amount = this.paymentAmountInSubunits(order.totalAmount);
    const gatewayOrder = this.isConfigured()
      ? await this.createRazorpayOrder(
          order.orderNumber,
          amount,
          currency,
        )
      : {
          id: `local_order_${order.id}_${Date.now()}`,
          amount,
          currency,
        };

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        amount: order.totalAmount,
        razorpayOrderId: gatewayOrder.id,
        gatewayResponse: {
          orderCreated: true,
          localMode: !this.isConfigured(),
        },
      },
    });
    return {
      paymentId: payment.id,
      keyId: this.keyId() || 'local',
      ...gatewayOrder,
      localMode: !this.isConfigured(),
      reused: false,
    };
  }

  async getPaymentBatchSummary(userId: string, orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, order: { userId } },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, userId },
        select: { id: true, totalAmount: true, checkoutBatchId: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      const batchOrders = order.checkoutBatchId
        ? await this.prisma.order.findMany({
            where: { checkoutBatchId: order.checkoutBatchId, userId },
            select: { id: true, totalAmount: true },
            orderBy: { createdAt: 'asc' },
          })
        : [order];
      const totalAmount = batchOrders.reduce(
        (sum, row) => sum.plus(row.totalAmount),
        new Prisma.Decimal(0),
      );
      return {
        orderCount: batchOrders.length,
        orderIds: batchOrders.map((row) => row.id),
        totalAmount: totalAmount.toFixed(2),
      };
    }
    const payments = payment.razorpayOrderId
      ? await this.prisma.payment.findMany({
          where: {
            razorpayOrderId: payment.razorpayOrderId,
            order: { userId },
          },
          include: { order: { select: { id: true, orderNumber: true } } },
        })
      : [payment];
    const totalAmount = payments.reduce(
      (sum, row) => sum.plus(row.amount),
      new Prisma.Decimal(0),
    );
    return {
      orderCount: payments.length,
      orderIds: payments.map((row) => row.orderId),
      totalAmount: totalAmount.toFixed(2),
    };
  }

  async createBatchGatewayOrder(userId: string, orderIds: string[]) {
    this.assertPaymentModeAvailable();
    const uniqueIds = [...new Set(orderIds)];
    const orders = await this.prisma.order.findMany({
      where: { id: { in: uniqueIds }, userId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (orders.length !== uniqueIds.length) {
      throw new NotFoundException('One or more orders were not found');
    }
    if (orders.some((order) => order.orderStatus !== OrderStatus.PENDING_PAYMENT)) {
      throw new BadRequestException('Every order must be awaiting payment');
    }
    const total = orders.reduce(
      (sum, order) => sum.plus(order.totalAmount),
      new Prisma.Decimal(0),
    );
    const amount = this.paymentAmountInSubunits(total);
    const currency = await this.currency();
    const reusableGatewayId = orders[0].payments.find(
      (payment) =>
        payment.paymentStatus === PaymentStatus.PENDING &&
        payment.razorpayOrderId &&
        orders.every((order) =>
          order.payments.some(
            (candidate) =>
              candidate.paymentStatus === PaymentStatus.PENDING &&
              candidate.razorpayOrderId === payment.razorpayOrderId,
          ),
        ),
    )?.razorpayOrderId;
    if (reusableGatewayId) {
      return {
        keyId: this.keyId() || 'local',
        id: reusableGatewayId,
        amount,
        currency,
        orderIds: uniqueIds,
        localMode: !this.isConfigured(),
        reused: true,
      };
    }
    const gatewayOrder = this.isConfigured()
      ? await this.createRazorpayOrder(
          `batch-${orders[0].orderNumber}`,
          amount,
          currency,
        )
      : {
          id: `local_batch_${Date.now()}`,
          amount,
          currency,
        };
    await this.prisma.payment.createMany({
      data: orders.map((order) => ({
        orderId: order.id,
        amount: order.totalAmount,
        razorpayOrderId: gatewayOrder.id,
        gatewayResponse: {
          orderCreated: true,
          batchOrderIds: uniqueIds,
          localMode: !this.isConfigured(),
        },
      })),
    });
    return {
      keyId: this.keyId() || 'local',
      ...gatewayOrder,
      orderIds: uniqueIds,
      localMode: !this.isConfigured(),
      reused: false,
    };
  }

  async verify(userId: string, dto: VerifyPaymentDto) {
    this.assertPaymentModeAvailable();
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: dto.razorpayOrderId, order: { userId } },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const batchPayments = await this.prisma.payment.findMany({
      where: { razorpayOrderId: dto.razorpayOrderId, order: { userId } },
    });
    if (
      batchPayments.length > 0 &&
      batchPayments.every((row) => row.paymentStatus === PaymentStatus.PAID)
    ) {
      return { success: true, orderId: payment.orderId };
    }

    const expected = this.isConfigured()
      ? crypto
          .createHmac('sha256', this.keySecret())
          .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
          .digest('hex')
      : 'local_success';
    if (!this.safeEqual(dto.razorpaySignature, expected)) {
      throw new BadRequestException('Invalid payment signature');
    }

    const batchAmount = batchPayments.reduce(
      (sum, row) => sum.plus(row.amount),
      new Prisma.Decimal(0),
    );
    let gatewayPayment: GatewayPayment = {
      id: dto.razorpayPaymentId,
      order_id: dto.razorpayOrderId,
      amount: batchAmount.mul(100).toNumber(),
      status: 'captured',
      method: 'local',
    };
    if (this.isConfigured()) {
      gatewayPayment = (await this.client().payments.fetch(
        dto.razorpayPaymentId,
      )) as GatewayPayment;
      const expectedAmount = this.paymentAmountInSubunits(batchAmount);
      if (
        gatewayPayment.order_id !== dto.razorpayOrderId ||
        Number(gatewayPayment.amount) !== expectedAmount ||
        gatewayPayment.status !== 'captured'
      ) {
        throw new BadRequestException(
          'Payment details could not be reconciled',
        );
      }
    }

    for (const row of batchPayments) {
      await this.markPaid(
        row.id,
        dto.razorpayPaymentId,
        dto.razorpaySignature,
        gatewayPayment,
      );
    }
    return { success: true, orderId: payment.orderId };
  }

  async webhook(
    rawBody: Buffer,
    payload: RazorpayWebhookPayload,
    signature?: string,
    providerEventId?: string,
  ) {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (secret) {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      if (!signature || !this.safeEqual(signature, expected)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new UnauthorizedException('Razorpay webhook is not configured');
    }

    const eventType = String(payload.event || 'unknown');
    const eventId =
      providerEventId ||
      crypto.createHash('sha256').update(rawBody).digest('hex');
    let retryingUnprocessed = false;
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          providerEventId: eventId,
          eventType,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const existing = await this.prisma.paymentWebhookEvent.findUnique({
          where: { providerEventId: eventId },
        });
        if (existing?.processedAt) {
          return { received: true, duplicate: true };
        }
        retryingUnprocessed = true;
      } else {
        throw error;
      }
    }

    try {
      await this.processWebhook(eventType, payload);
      await this.prisma.paymentWebhookEvent.update({
        where: { providerEventId: eventId },
        data: { processedAt: new Date(), processingError: null },
      });
      return {
        received: true,
        ...(retryingUnprocessed ? { retried: true } : {}),
      };
    } catch (error) {
      await this.prisma.paymentWebhookEvent.update({
        where: { providerEventId: eventId },
        data: {
          processingError:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async createRefund(adminId: string, paymentId: string, reason?: string) {
    this.assertPaymentModeAvailable();
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, order: true },
    });
    if (!payment) {
      throw new BadRequestException('Refundable payment not found');
    }
    const existing = payment.refunds.find(
      (refund) => refund.refundStatus !== RefundStatus.FAILED,
    );
    if (existing) return this.serializeRefund(existing);
    if (
      payment.paymentStatus !== PaymentStatus.PAID ||
      !payment.razorpayPaymentId
    ) {
      throw new BadRequestException('Refundable payment not found');
    }
    const amount = payment.amount;

    const refund = await this.prisma.refund.create({
      data: {
        paymentId,
        amount,
        reason: reason?.trim(),
        initiatedById: adminId,
        refundStatus: this.isConfigured()
          ? RefundStatus.PROCESSING
          : RefundStatus.SUCCESS,
        processedAt: this.isConfigured() ? undefined : new Date(),
        razorpayRefundId: this.isConfigured()
          ? undefined
          : `local_refund_${Date.now()}`,
        gatewayResponse: { localMode: !this.isConfigured() },
      },
    });

    if (!this.isConfigured()) {
      await this.reconcileRefund(paymentId);
      return this.serializeRefund(refund);
    }

    try {
      const gateway = await this.client().payments.refund(
        payment.razorpayPaymentId,
        {
          amount: amount.mul(100).toNumber(),
          speed: 'normal',
          notes: {
            reason: reason || 'Admin initiated refund',
            orderId: payment.orderId,
          },
        },
      );
      const updated = await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          razorpayRefundId: gateway.id,
          refundStatus:
            gateway.status === 'processed'
              ? RefundStatus.SUCCESS
              : RefundStatus.PROCESSING,
          processedAt: gateway.status === 'processed' ? new Date() : undefined,
          gatewayResponse: gateway as unknown as Prisma.InputJsonValue,
        },
      });
      if (updated.refundStatus === RefundStatus.SUCCESS)
        await this.reconcileRefund(paymentId);
      return this.serializeRefund(updated);
    } catch (error) {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          refundStatus: RefundStatus.FAILED,
          processedAt: new Date(),
          gatewayResponse: { error: this.gatewayError(error) },
        },
      });
      throw new BadGatewayException('Razorpay refund could not be initiated');
    }
  }

  private async processWebhook(
    eventType: string,
    payload: RazorpayWebhookPayload,
  ) {
    if (eventType === 'payment.captured') {
      const entity = payload.payload?.payment?.entity;
      if (!entity?.id || !entity.order_id) return;
      const payments = await this.prisma.payment.findMany({
        where: { razorpayOrderId: entity.order_id },
      });
      if (!payments.length) return;
      const expectedAmount = payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
      if (
        entity.status !== 'captured' ||
        !Number.isSafeInteger(Number(entity.amount)) ||
        Number(entity.amount) !== expectedAmount.mul(100).toNumber()
      ) {
        throw new BadRequestException(
          'Captured payment details could not be reconciled',
        );
      }
      for (const payment of payments) {
        await this.markPaid(payment.id, entity.id, undefined, entity);
      }
      return;
    }

    if (eventType === 'payment.failed') {
      const entity = payload.payload?.payment?.entity;
      if (!entity?.order_id) return;
      const payments = await this.prisma.payment.findMany({
        where: { razorpayOrderId: entity.order_id },
        include: { order: true },
      });
      const retryable = payments.filter(
        (payment) => payment.paymentStatus !== PaymentStatus.PAID,
      );
      if (!retryable.length) return;
      await this.prisma.$transaction(async (tx) => {
        for (const payment of retryable) {
          const failed = await tx.payment.updateMany({
            where: {
              id: payment.id,
              paymentStatus: { not: PaymentStatus.PAID },
            },
            data: {
              paymentStatus: PaymentStatus.FAILED,
              razorpayPaymentId: entity.id,
              paymentMethod: entity.method,
              failureReason: entity.error_description || 'Payment failed',
              gatewayResponse: entity as unknown as Prisma.InputJsonValue,
            },
          });
          if (failed.count === 0) continue;
          const otherPaidPayments = await tx.payment.count({
            where: {
              orderId: payment.orderId,
              id: { not: payment.id },
              paymentStatus: PaymentStatus.PAID,
            },
          });
          if (otherPaidPayments > 0) continue;
          await tx.order.updateMany({
            where: {
              id: payment.orderId,
              paymentStatus: { not: PaymentStatus.PAID },
            },
            data: { paymentStatus: PaymentStatus.FAILED },
          });
        }
      });
      return;
    }

    if (eventType.startsWith('refund.')) {
      const entity = payload.payload?.refund?.entity;
      if (!entity?.id) return;
      const refund = await this.prisma.refund.findFirst({
        where: { razorpayRefundId: entity.id },
      });
      if (!refund) return;
      const status =
        eventType === 'refund.failed' || entity.status === 'failed'
          ? RefundStatus.FAILED
          : eventType === 'refund.processed' || entity.status === 'processed'
            ? RefundStatus.SUCCESS
            : RefundStatus.PROCESSING;
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          refundStatus: status,
          processedAt:
            status === RefundStatus.SUCCESS || status === RefundStatus.FAILED
              ? new Date()
              : undefined,
          gatewayResponse: entity as unknown as Prisma.InputJsonValue,
        },
      });
      if (status !== RefundStatus.PROCESSING)
        await this.reconcileRefund(refund.paymentId);
    }
  }

  private async markPaid(
    paymentId: string,
    razorpayPaymentId: string,
    signature: string | undefined,
    gatewayPayment: GatewayPayment,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment || payment.paymentStatus === PaymentStatus.PAID) return;
    const marked = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: {
          id: payment.id,
          paymentStatus: { not: PaymentStatus.PAID },
        },
        data: {
          paymentStatus: PaymentStatus.PAID,
          razorpayPaymentId,
          razorpaySignature: signature,
          paymentMethod: gatewayPayment.method,
          paidAt: new Date(),
          failureReason: null,
          gatewayResponse: gatewayPayment as unknown as Prisma.InputJsonValue,
        },
      });
      if (claimed.count === 0) return false;
      const confirmOrder =
        payment.order.orderStatus === OrderStatus.PENDING_PAYMENT;
      await tx.order.update({
        where: { id: payment.orderId },
        data: confirmOrder
          ? {
              paymentStatus: PaymentStatus.PAID,
              orderStatus: OrderStatus.CONFIRMED,
              statusHistory: {
                create: {
                  fromStatus: payment.order.orderStatus,
                  toStatus: OrderStatus.CONFIRMED,
                  notes: 'Payment verified',
                },
              },
            }
          : {
              // A late gateway callback must never resurrect a cancelled or
              // otherwise progressed order. Record the funds for reconciliation
              // while preserving the operational order state.
              paymentStatus: PaymentStatus.PAID,
            },
      });
      return true;
    });
    if (marked) {
      await this.operations.generateOrderDocuments(payment.orderId);
    }
  }

  private async reconcileRefund(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, order: true },
    });
    if (!payment) return;
    const total = payment.refunds
      .filter((refund) => refund.refundStatus === RefundStatus.SUCCESS)
      .reduce((sum, refund) => sum.plus(refund.amount), new Prisma.Decimal(0));
    const paymentStatus = total.gte(payment.amount)
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PAID;
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { paymentStatus },
      });
      const otherPaidPayments = await tx.payment.count({
        where: {
          orderId: payment.orderId,
          id: { not: paymentId },
          paymentStatus: PaymentStatus.PAID,
        },
      });
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus:
            otherPaidPayments > 0 ? PaymentStatus.PAID : paymentStatus,
        },
      });
    });
    await this.operations.generateOrderDocuments(payment.orderId);
  }

  private async createRazorpayOrder(
    receipt: string,
    amount: number,
    currency: string,
  ) {
    if (!Number.isSafeInteger(amount) || amount < 100) {
      throw new BadRequestException(
        'Payment amount must be at least 100 currency subunits',
      );
    }
    try {
      const created = await this.client().orders.create({
        amount,
        currency,
        receipt: receipt.slice(0, 40),
        notes: { source: 'the-feast-factory' },
      });
      return {
        id: created.id,
        amount: Number(created.amount),
        currency: created.currency,
      };
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 401) {
        throw new UnauthorizedException(
          'Payment provider authentication failed',
        );
      }
      throw new BadGatewayException(
        'Payment provider is temporarily unavailable',
      );
    }
  }

  private client() {
    return new Razorpay({ key_id: this.keyId(), key_secret: this.keySecret() });
  }

  private isConfigured() {
    return Boolean(this.keyId() && this.keySecret());
  }

  private assertPaymentModeAvailable() {
    if (
      !this.isConfigured() &&
      this.config.get<string>('NODE_ENV') === 'production'
    ) {
      throw new ServiceUnavailableException(
        'Payment provider is not configured',
      );
    }
  }

  private keyId() {
    return this.config.get<string>('RAZORPAY_KEY_ID') || '';
  }

  private keySecret() {
    return this.config.get<string>('RAZORPAY_KEY_SECRET') || '';
  }

  private async currency() {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: 'razorpay_currency' },
    });
    return (
      setting?.value || this.config.get<string>('RAZORPAY_CURRENCY', 'INR')
    );
  }

  private safeEqual(actual: string, expected: string) {
    const left = Buffer.from(actual);
    const right = Buffer.from(expected);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }

  private paymentAmountInSubunits(amount: Prisma.Decimal) {
    const subunits = amount.mul(100).toNumber();
    if (!Number.isSafeInteger(subunits) || subunits < 100) {
      throw new BadRequestException(
        'Payment amount must be at least 100 currency subunits',
      );
    }
    return subunits;
  }

  private serializeRefund<T extends { amount: Prisma.Decimal }>(refund: T) {
    return { ...refund, amount: refund.amount.toFixed(2) };
  }

  private gatewayError(error: unknown) {
    if (!error || typeof error !== 'object') return 'Unknown gateway error';
    const candidate = error as {
      error?: { description?: string };
      message?: string;
    };
    return (
      candidate.error?.description ||
      candidate.message ||
      'Unknown gateway error'
    );
  }
}
