import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CartStatus,
  CheckoutAttemptStatus,
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
import { OrderNotificationService } from '../notifications/order-notification.service';
import { CartService } from '../cart/cart.service';
import {
  cartFingerprint,
  type CheckoutSnapshot,
} from '../cart/checkout-snapshot';
import { storedEventInstant } from '../../common/event-time';

type GatewayPayment = {
  id: string;
  order_id?: string | null;
  amount: number;
  status: string;
  method?: string;
  error_description?: string;
};
type GatewayOrderDetails = {
  id: string;
  amount: number;
  amount_due?: number;
  amount_paid?: number;
  currency: string;
  status: string;
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
    @Optional() private readonly notifications?: OrderNotificationService,
    @Optional() private readonly carts?: CartService,
  ) {}

  async createCartGatewayOrder(userId: string, specialNotes?: string) {
    this.assertPaymentModeAvailable();
    if (!this.carts)
      throw new ServiceUnavailableException('Cart checkout is unavailable');
    const snapshot = await this.carts.preparePayment(userId, specialNotes);
    await this.assertNoUnconfirmedCapture(userId, snapshot);
    const amount = this.paymentAmountInSubunits(
      new Prisma.Decimal(snapshot.totalAmount),
    );
    const currency = await this.currency();
    const attemptId = crypto.randomUUID();
    const gatewayOrder = this.isConfigured()
      ? await this.createRazorpayOrder(`cart-${attemptId}`, amount, currency)
      : { id: `local_cart_${attemptId}`, amount, currency };
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.updateMany({
        where: {
          id: { in: snapshot.carts.map((cart) => cart.cartId) },
          userId,
          status: CartStatus.ACTIVE,
        },
        data: { paymentTryCount: { increment: 1 } },
      });
      if (updated.count !== snapshot.carts.length) {
        throw new BadRequestException(
          'Your cart changed. Review it and try payment again.',
        );
      }
      await tx.checkoutAttempt.create({
        data: {
          id: attemptId,
          userId,
          razorpayOrderId: gatewayOrder.id,
          amount: snapshot.totalAmount,
          currency,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return {
      keyId: this.keyId() || 'local',
      ...gatewayOrder,
      localMode: !this.isConfigured(),
      attemptId,
    };
  }

  private async assertNoUnconfirmedCapture(
    userId: string,
    snapshot: CheckoutSnapshot,
  ) {
    const cartIds = new Set(snapshot.carts.map((cart) => cart.cartId));
    const attempts = await this.prisma.checkoutAttempt.findMany({
      where: {
        userId,
        status: {
          in: [
            CheckoutAttemptStatus.PENDING,
            CheckoutAttemptStatus.FAILED,
            CheckoutAttemptStatus.PROCESSING,
            CheckoutAttemptStatus.NEEDS_REVIEW,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const attempt of attempts) {
      const prior = attempt.snapshot as unknown as CheckoutSnapshot;
      if (!prior?.carts?.some((cart) => cartIds.has(cart.cartId))) continue;
      if (
        attempt.status === CheckoutAttemptStatus.NEEDS_REVIEW ||
        attempt.status === CheckoutAttemptStatus.PROCESSING ||
        (!this.isConfigured() && attempt.razorpayPaymentId)
      ) {
        throw new ServiceUnavailableException(
          'Payment captured; order confirmation is pending. Do not retry payment. Contact support.',
        );
      }
      if (!this.isConfigured()) continue;
      let gateway: GatewayOrderDetails;
      try {
        gateway = (await this.client().orders.fetch(
          attempt.razorpayOrderId,
        )) as GatewayOrderDetails;
      } catch {
        throw new ServiceUnavailableException(
          'Could not check the previous payment. Do not retry until its status is confirmed.',
        );
      }
      if (gateway.status === 'paid' || Number(gateway.amount_paid ?? 0) > 0) {
        throw new ServiceUnavailableException(
          'Payment captured; order confirmation is pending. Do not retry payment. Contact support.',
        );
      }
      if (gateway.status === 'attempted') {
        let gatewayPayments: { items: Array<{ status: string }> };
        try {
          gatewayPayments = await this.client().orders.fetchPayments(
            attempt.razorpayOrderId,
          );
        } catch {
          throw new ServiceUnavailableException(
            'Could not check the previous payment. Do not retry until its status is confirmed.',
          );
        }
        if (
          !gatewayPayments.items.length ||
          gatewayPayments.items.some((payment) => payment.status !== 'failed')
        ) {
          throw new ServiceUnavailableException(
            'The previous payment is still being checked. Do not retry until its status is confirmed.',
          );
        }
        await this.prisma.checkoutAttempt.updateMany({
          where: { id: attempt.id, status: CheckoutAttemptStatus.PENDING },
          data: {
            status: CheckoutAttemptStatus.FAILED,
            failureReason: 'All provider payment attempts failed',
          },
        });
      }
    }
  }

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
      if (
        !this.isConfigured() ||
        (await this.canReuseGatewayOrder(
          existing.razorpayOrderId!,
          amount,
          currency,
        ))
      ) {
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
      await this.retireGatewayOrder(existing.razorpayOrderId!);
    }

    const amount = this.paymentAmountInSubunits(order.totalAmount);
    const gatewayOrder = this.isConfigured()
      ? await this.createRazorpayOrder(
          existing
            ? this.replacementReceipt(order.orderNumber)
            : order.orderNumber,
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
    if (
      orders.some((order) => order.orderStatus !== OrderStatus.PENDING_PAYMENT)
    ) {
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
    if (
      reusableGatewayId &&
      (!this.isConfigured() ||
        (await this.canReuseGatewayOrder(reusableGatewayId, amount, currency)))
    ) {
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
    if (reusableGatewayId) {
      await this.retireGatewayOrder(reusableGatewayId);
    }
    const gatewayOrder = this.isConfigured()
      ? await this.createRazorpayOrder(
          reusableGatewayId
            ? this.replacementReceipt(`batch-${orders[0].orderNumber}`)
            : `batch-${orders[0].orderNumber}`,
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
    const cartAttempt = await this.prisma.checkoutAttempt.findUnique({
      where: { razorpayOrderId: dto.razorpayOrderId },
    });
    if (cartAttempt) {
      if (cartAttempt.userId !== userId)
        throw new NotFoundException('Payment not found');
      if (cartAttempt.status === CheckoutAttemptStatus.PAID) {
        const ids = cartAttempt.orderIds as string[] | null;
        return { success: true, orderId: ids?.[0], orderIds: ids ?? [] };
      }
      const expectedSignature = this.isConfigured()
        ? crypto
            .createHmac('sha256', this.keySecret())
            .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
            .digest('hex')
        : 'local_success';
      if (!this.safeEqual(dto.razorpaySignature, expectedSignature)) {
        throw new BadRequestException('Invalid payment signature');
      }
      let captured: GatewayPayment = {
        id: dto.razorpayPaymentId,
        order_id: dto.razorpayOrderId,
        amount: this.paymentAmountInSubunits(cartAttempt.amount),
        status: 'captured',
        method: 'local',
      };
      if (this.isConfigured()) {
        captured = (await this.client().payments.fetch(
          dto.razorpayPaymentId,
        )) as GatewayPayment;
        if (
          captured.order_id !== dto.razorpayOrderId ||
          Number(captured.amount) !==
            this.paymentAmountInSubunits(cartAttempt.amount) ||
          captured.status !== 'captured'
        ) {
          throw new BadRequestException(
            'Payment details could not be reconciled',
          );
        }
      }
      try {
        return await this.finalizeCartAttempt(
          cartAttempt.id,
          captured,
          dto.razorpaySignature,
        );
      } catch (error) {
        console.error(
          '[Payments] Captured cart payment could not be finalized',
          error,
        );
        throw new ServiceUnavailableException(
          'Payment captured; order confirmation is pending. Do not retry payment. Contact support.',
        );
      }
    }
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

  private async finalizeCartAttempt(
    attemptId: string,
    gatewayPayment: GatewayPayment,
    signature?: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const attempt = await tx.checkoutAttempt.findUniqueOrThrow({
          where: { id: attemptId },
        });
        if (attempt.status === CheckoutAttemptStatus.PAID) {
          const ids = attempt.orderIds as string[] | null;
          return {
            success: true,
            orderId: ids?.[0],
            orderIds: ids ?? [],
            created: false,
          };
        }
        if (attempt.status === CheckoutAttemptStatus.NEEDS_REVIEW) {
          return { success: false, needsReview: true, created: false };
        }
        const snapshot = attempt.snapshot as unknown as CheckoutSnapshot;
        if (
          !snapshot?.carts?.length ||
          new Prisma.Decimal(snapshot.totalAmount).toFixed(2) !==
            attempt.amount.toFixed(2) ||
          Number(gatewayPayment.amount) !==
            this.paymentAmountInSubunits(attempt.amount) ||
          gatewayPayment.order_id !== attempt.razorpayOrderId ||
          gatewayPayment.status !== 'captured'
        ) {
          throw new BadRequestException(
            'Captured payment details could not be reconciled',
          );
        }
        const claimed = await tx.checkoutAttempt.updateMany({
          where: {
            id: attemptId,
            status: {
              in: [CheckoutAttemptStatus.PENDING, CheckoutAttemptStatus.FAILED],
            },
          },
          data: {
            status: CheckoutAttemptStatus.PROCESSING,
            razorpayPaymentId: gatewayPayment.id,
          },
        });
        if (claimed.count === 0) {
          const current = await tx.checkoutAttempt.findUniqueOrThrow({
            where: { id: attemptId },
          });
          const ids = current.orderIds as string[] | null;
          return current.status === CheckoutAttemptStatus.PAID
            ? {
                success: true,
                orderId: ids?.[0],
                orderIds: ids ?? [],
                created: false,
              }
            : { success: false, needsReview: true, created: false };
        }
        const sourceCartIds = snapshot.carts.map((cart) => cart.cartId);
        const priorOrders = await tx.order.count({
          where: { sourceCartId: { in: sourceCartIds } },
        });
        if (priorOrders > 0) {
          await tx.checkoutAttempt.update({
            where: { id: attemptId },
            data: {
              status: CheckoutAttemptStatus.NEEDS_REVIEW,
              failureReason:
                'A captured payment already exists for this cart; review for refund',
            },
          });
          return { success: false, needsReview: true, created: false };
        }
        const checkoutBatchId =
          snapshot.carts.length > 1 ? crypto.randomUUID() : null;
        const orderIds: string[] = [];
        for (const cart of snapshot.carts) {
          const eventDate = new Date(cart.eventDate);
          const eventTimeStart = new Date(cart.eventTimeStart);
          const leadHours = Math.floor(
            (storedEventInstant(eventDate, eventTimeStart).getTime() -
              Date.now()) /
              3_600_000,
          );
          const order = await tx.order.create({
            data: {
              orderNumber: `ORD-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
              userId: attempt.userId,
              sourceCartId: cart.cartId,
              checkoutBatchId,
              regionId: cart.regionId,
              addressId: cart.addressId,
              eventName: cart.eventName,
              eventDate,
              eventTimeStart,
              specialNotes: cart.specialNotes,
              contactNumber: cart.contactNumber,
              packageType: cart.packageType,
              guestCount: cart.guestCount,
              basePerPlatePrice: cart.basePerPlatePrice,
              totalCustomizationCharges: cart.totalCustomizationCharges,
              finalPerPlatePrice: cart.finalPerPlatePrice,
              totalAmount: cart.totalAmount,
              distanceKm: cart.distanceKm,
              deliveryFee: cart.deliveryFee,
              deliveryServiceType: cart.deliveryServiceType,
              helperCount: cart.helperCount,
              cutleryIncludedCount: cart.cutleryIncludedCount,
              cutleryExtraCount: cart.cutleryExtraCount,
              cutleryUnitPrice: cart.cutleryUnitPrice,
              cutleryTotal: cart.cutleryTotal,
              packageName: cart.packageName,
              packageImageUrl: cart.packageImageUrl ?? null,
              packageVersionNo: cart.packageVersionNo,
              orderStatus: OrderStatus.CONFIRMED,
              paymentStatus: PaymentStatus.PAID,
              bookingLeadHours: leadHours,
              selectedItems: { create: cart.selectedItems },
              statusHistory: {
                create: {
                  toStatus: OrderStatus.CONFIRMED,
                  notes: 'Payment verified',
                },
              },
              payments: {
                create: {
                  amount: cart.totalAmount,
                  paymentStatus: PaymentStatus.PAID,
                  razorpayOrderId: attempt.razorpayOrderId,
                  razorpayPaymentId: gatewayPayment.id,
                  razorpaySignature: signature,
                  paymentMethod: gatewayPayment.method,
                  paidAt: new Date(),
                  gatewayResponse:
                    gatewayPayment as unknown as Prisma.InputJsonValue,
                },
              },
            },
            select: { id: true },
          });
          orderIds.push(order.id);
        }
        for (const paidCart of snapshot.carts) {
          await tx.$queryRaw`SELECT id FROM "carts" WHERE id = ${paidCart.cartId} FOR UPDATE`;
          const current = await tx.cart.findUnique({
            where: { id: paidCart.cartId },
            include: { items: true },
          });
          if (current?.status !== CartStatus.ACTIVE) continue;
          if (cartFingerprint(current) !== paidCart.cartFingerprint) {
            // A late capture must not discard edits made after the gateway opened.
            // Give those edits a fresh cart ID so a future payment is independent.
            await tx.cart.create({
              data: {
                userId: current.userId,
                packageVersionId: current.packageVersionId,
                addressId: current.addressId,
                regionId: current.regionId,
                eventName: current.eventName,
                eventDate: current.eventDate,
                eventTimeStart: current.eventTimeStart,
                guestCount: current.guestCount,
                distanceKm: current.distanceKm,
                deliveryFee: current.deliveryFee,
                deliveryServiceType: current.deliveryServiceType,
                helperCount: current.helperCount,
                cutleryIncludedCount: current.cutleryIncludedCount,
                cutleryExtraCount: current.cutleryExtraCount,
                cutleryUnitPrice: current.cutleryUnitPrice,
                contactNumber: current.contactNumber,
                specialNotes: current.specialNotes,
                status: CartStatus.ACTIVE,
                expiresAt: current.expiresAt,
                lastQuotedAt: current.lastQuotedAt,
                items: {
                  create: current.items.map((item) => ({
                    categoryId: item.categoryId,
                    menuItemId: item.menuItemId,
                    replacedMenuItemId: item.replacedMenuItemId,
                    role: item.role,
                    quantity: item.quantity,
                    weightGrams: item.weightGrams,
                  })),
                },
              },
            });
          }
          await tx.cartItem.deleteMany({ where: { cartId: paidCart.cartId } });
          await tx.cart.delete({ where: { id: paidCart.cartId } });
        }
        await tx.checkoutAttempt.update({
          where: { id: attemptId },
          data: {
            status: CheckoutAttemptStatus.PAID,
            orderIds,
            failureReason: null,
          },
        });
        return { success: true, orderId: orderIds[0], orderIds, created: true };
      },
      { timeout: 30_000 },
    );
    if (result.success && result.created) {
      for (const orderId of result.orderIds ?? []) {
        try {
          await this.operations.generateOrderDocuments(orderId);
        } catch (error) {
          console.error('[Payments] Order document generation failed', error);
        }
        void this.notifications?.notifyConfirmedOrder(orderId);
      }
    }
    return result;
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
      const cartAttempt = await this.prisma.checkoutAttempt.findUnique({
        where: { razorpayOrderId: entity.order_id },
      });
      if (cartAttempt) {
        await this.finalizeCartAttempt(cartAttempt.id, entity);
        return;
      }
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
      const cartAttempt = await this.prisma.checkoutAttempt.findUnique({
        where: { razorpayOrderId: entity.order_id },
      });
      if (cartAttempt) {
        await this.prisma.checkoutAttempt.updateMany({
          where: {
            id: cartAttempt.id,
            status: CheckoutAttemptStatus.PENDING,
          },
          data: {
            status: CheckoutAttemptStatus.FAILED,
            failureReason: entity.error_description || 'Payment failed',
          },
        });
        return;
      }
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
      void this.notifications?.notifyConfirmedOrder(payment.orderId);
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

  private async canReuseGatewayOrder(
    orderId: string,
    expectedAmount: number,
    expectedCurrency: string,
  ) {
    let order: GatewayOrderDetails;
    try {
      order = (await this.client().orders.fetch(
        orderId,
      )) as GatewayOrderDetails;
    } catch (error) {
      const description = this.gatewayError(error).toLowerCase();
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (
        statusCode === 401 ||
        description.includes('authentication failed') ||
        description.includes('api key') ||
        description.includes('credentials')
      ) {
        throw new UnauthorizedException(
          'Payment provider authentication failed',
        );
      }
      if (
        statusCode === 400 &&
        (description.includes('does not exist') ||
          description.includes('does not belong') ||
          description.includes('not a valid id') ||
          description.includes('invalid id'))
      ) {
        return false;
      }
      throw new BadGatewayException(
        'Payment provider is temporarily unavailable',
      );
    }

    if (order.status === 'paid' || Number(order.amount_paid ?? 0) > 0) {
      throw new BadRequestException(
        'Payment is already completed and awaiting confirmation',
      );
    }
    return (
      (order.status === 'created' || order.status === 'attempted') &&
      Number(order.amount) === expectedAmount &&
      String(order.currency).toUpperCase() === expectedCurrency.toUpperCase() &&
      Number(order.amount_due ?? order.amount) === expectedAmount
    );
  }

  private async retireGatewayOrder(orderId: string) {
    await this.prisma.payment.updateMany({
      where: {
        razorpayOrderId: orderId,
        paymentStatus: PaymentStatus.PENDING,
      },
      data: {
        paymentStatus: PaymentStatus.FAILED,
        failureReason:
          'Gateway order replaced because it is not valid for the active payment account',
      },
    });
  }

  private replacementReceipt(receipt: string) {
    return `${receipt.slice(0, 20)}-retry-${Date.now()}`;
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
