import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import PDFDocument from 'pdfkit';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderNoteDto } from './dto/create-order-note.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  clockMinutes,
  nonNegativeIntegerSetting,
  positiveIntegerSetting,
} from '../../common/setting-values';

const editableSettings = new Set([
  'min_booking_lead_hours',
  'otp_expiry_seconds',
  'otp_max_attempts',
  'razorpay_currency',
  'event_service_start_time',
  'event_service_end_time',
  'event_time_interval_minutes',
  'business_legal_name',
  'business_trade_name',
  'business_address',
  'business_gstin',
  'business_state_code',
  'business_pan',
  'business_support_email',
  'business_support_phone',
  'business_logo_url',
  'invoice_prefix',
  'receipt_prefix',
  'credit_note_prefix',
  'tax_cgst_rate',
  'tax_sgst_rate',
  'tax_igst_rate',
  'tax_sac_code',
  'invoice_legal_footer',
]);

const documentBusinessDefaults = {
  legalName: 'The Feast Factory Foods Private Limited',
  tradeName: 'The Feast Factory',
};

type PdfSnapshot = {
  business: {
    legalName: string;
    tradeName: string;
    address: string;
    gstin: string;
    sacCode: string;
    legalFooter: string;
  };
  order: {
    orderNumber: string;
    packageName: string;
    guestCount: number;
    finalPerPlatePrice: string;
    basePerPlatePrice: string;
    customizationCharges: string;
    deliveryFee: string;
    totalAmount: string;
    eventDate: string | Date;
    address: {
      addressLine1: string;
      city: string;
      state: string;
      pincode: string;
    };
    customer: { name?: string | null; mobileNumber: string; email?: string | null };
    payment?: { reference?: string | null; method?: string | null; paidAt?: string | Date | null } | null;
    items: Array<{ name: string; category: string; role: string; itemPrice: string; adjustmentAmount: string }>;
  };
  tax: { cgstRate: string; sgstRate: string; igstRate: string };
  refund?: { amount: string; reason?: string | null };
};

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly regions: OperatingRegionsService,
  ) {}

  async notes(admin: JwtPayload, orderId: string) {
    await this.assertAdminOrder(admin, orderId);
    return this.prisma.orderNote.findMany({
      where: { orderId },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addNote(admin: JwtPayload, orderId: string, dto: CreateOrderNoteDto) {
    await this.assertAdminOrder(admin, orderId);
    return this.prisma.orderNote.create({
      data: { orderId, authorId: admin.sub, body: dto.body.trim() },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
  }

  async calendar(
    admin: JwtPayload,
    from?: string,
    to?: string,
    requestedRegionId?: string,
    city?: string,
  ) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      requestedRegionId,
    );
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 30 * 86_400_000);
    if (start > end) {
      throw new BadRequestException(
        'Calendar start date must not be after the end date',
      );
    }
    const orders = await this.prisma.order.findMany({
      where: {
        eventDate: { gte: start, lte: end },
        orderStatus: { not: OrderStatus.PENDING_PAYMENT },
        ...(regionId ? { regionId } : {}),
        ...(city
          ? { address: { city: { contains: city, mode: 'insensitive' } } }
          : {}),
      },
      include: {
        address: true,
        region: true,
        user: { select: { id: true, name: true, mobileNumber: true } },
      },
      orderBy: [{ eventDate: 'asc' }, { eventTimeStart: 'asc' }],
    });
    return orders.map((order) => ({
      ...order,
      orders: [{
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
      }],
    }));
  }

  async queue(admin: JwtPayload, requestedRegionId?: string) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      requestedRegionId,
    );
    const now = new Date();
    const upcoming = new Date(now.getTime() + 7 * 86_400_000);
    const [events, failedPayments, pendingRefunds] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          eventDate: { gte: now, lte: upcoming },
          orderStatus: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT],
          },
          ...(regionId ? { regionId } : {}),
        },
        include: { address: true, region: true, user: true },
        orderBy: { eventDate: 'asc' },
        take: 30,
      }),
      this.prisma.payment.findMany({
        where: {
          paymentStatus: PaymentStatus.FAILED,
          ...(regionId ? { order: { regionId } } : {}),
        },
        include: { order: { include: { user: true, region: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.refund.findMany({
        where: {
          refundStatus: {
            in: [RefundStatus.INITIATED, RefundStatus.PROCESSING],
          },
          ...(regionId ? { payment: { order: { regionId } } } : {}),
        },
        include: {
          payment: { include: { order: { include: { region: true } } } },
        },
        orderBy: { initiatedAt: 'asc' },
        take: 20,
      }),
    ]);
    return {
      upcomingEvents: events.map((order) => ({
        ...order,
        orders: [{
          id: order.id,
          orderNumber: order.orderNumber,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
        }],
      })),
      failedPayments,
      pendingRefunds,
    };
  }

  settings() {
    return this.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const keys = dto.settings.map((setting) => setting.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate setting keys are not allowed');
    }
    const invalid = dto.settings.find(
      (setting) => !editableSettings.has(setting.key),
    );
    if (invalid)
      throw new BadRequestException(`Setting ${invalid.key} cannot be edited`);
    const submitted = Object.fromEntries(
      dto.settings.map((setting) => [setting.key, setting.value.trim()]),
    );
    this.validateSubmittedSettings(submitted);
    if (
      submitted.event_service_start_time !== undefined ||
      submitted.event_service_end_time !== undefined
    ) {
      const current = Object.fromEntries(
        (await this.settings()).map((setting) => [setting.key, setting.value]),
      );
      const start = clockMinutes(
        submitted.event_service_start_time ??
          current.event_service_start_time ??
          '06:00',
      );
      const end = clockMinutes(
        submitted.event_service_end_time ??
          current.event_service_end_time ??
          '23:30',
      );
      if (start === undefined || end === undefined || start >= end) {
        throw new BadRequestException(
          'Event service start time must be earlier than end time',
        );
      }
    }
    await this.prisma.$transaction(
      dto.settings.map((setting) =>
        this.prisma.platformSetting.upsert({
          where: { key: setting.key },
          create: { key: setting.key, value: setting.value.trim() },
          update: { value: setting.value.trim() },
        }),
      ),
    );
    return this.settings();
  }

  private validateSubmittedSettings(settings: Record<string, string>) {
    for (const key of [
      'otp_expiry_seconds',
      'otp_max_attempts',
      'event_time_interval_minutes',
    ]) {
      if (
        settings[key] !== undefined &&
        positiveIntegerSetting(settings[key], -1) === -1
      ) {
        throw new BadRequestException(`${key} must be a positive integer`);
      }
    }
    if (
      settings.min_booking_lead_hours !== undefined &&
      nonNegativeIntegerSetting(settings.min_booking_lead_hours, -1) === -1
    ) {
      throw new BadRequestException(
        'min_booking_lead_hours must be a non-negative integer',
      );
    }
    for (const key of [
      'event_service_start_time',
      'event_service_end_time',
    ]) {
      if (settings[key] !== undefined && clockMinutes(settings[key]) === undefined) {
        throw new BadRequestException(`${key} must use HH:mm format`);
      }
    }
    if (
      settings.razorpay_currency !== undefined &&
      !/^[A-Z]{3}$/.test(settings.razorpay_currency)
    ) {
      throw new BadRequestException(
        'razorpay_currency must be a three-letter uppercase code',
      );
    }
    for (const key of ['tax_cgst_rate', 'tax_sgst_rate', 'tax_igst_rate']) {
      if (settings[key] === undefined) continue;
      const value = Number(settings[key]);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new BadRequestException(`${key} must be between 0 and 100`);
      }
    }
  }

  readiness() {
    const configured = (keys: string[]) =>
      keys.every((key) => Boolean(this.config.get<string>(key)));
    return {
      razorpay: configured([
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
      ]),
      msg91:
        configured(['MSG91_AUTH_KEY', 'MSG91_FLOW_ID', 'MSG91_SENDER_ID']) ||
        configured(['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID', 'MSG91_SENDER_ID']),
      cloudflareR2: configured([
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET_NAME',
        'R2_PUBLIC_BASE_URL',
      ]),
      googleMaps: 'configured-client-side',
      resend: 'deferred',
      sentry: 'deferred',
    };
  }

  async documents(userId: string, orderId: string, admin?: JwtPayload) {
    const order = await this.loadDocumentOrder(orderId, userId, admin);
    await this.ensureDocuments(order);
    return this.prisma.orderDocument.findMany({
      where: { orderId },
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        generatedAt: true,
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async documentPdf(
    userId: string,
    orderId: string,
    documentId: string,
    admin?: JwtPayload,
  ) {
    await this.loadDocumentOrder(orderId, userId, admin);
    const document = await this.prisma.orderDocument.findFirst({
      where: { id: documentId, orderId },
    });
    if (!document) throw new NotFoundException('Document not found');
    return {
      filename: `${document.documentNumber}.pdf`,
      buffer: await this.renderPdf(
        document.documentType,
        document.documentNumber,
        document.snapshot,
      ),
    };
  }

  private async loadDocumentOrder(
    orderId: string,
    userId: string,
    admin?: JwtPayload,
  ) {
    const regionId = admin
      ? await this.regions.resolveAdminScope(admin)
      : undefined;
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(admin ? (regionId ? { regionId } : {}) : { userId }),
      },
      include: {
        user: true,
        address: true,
        selectedItems: true,
        payments: { include: { refunds: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async ensureDocuments(
    order: Awaited<ReturnType<OperationsService['loadDocumentOrder']>>,
  ) {
    const paid = order.payments.find(
      (payment) =>
        payment.paymentStatus === PaymentStatus.PAID ||
        payment.paymentStatus === PaymentStatus.REFUNDED,
    );
    if (!paid) return;
    const settings = Object.fromEntries(
      (await this.settings()).map((setting) => [setting.key, setting.value]),
    );
    const baseSnapshot = this.snapshot(order, settings);
    await this.ensureDocument(
      order.id,
      order.userId,
      paid.id,
      undefined,
      DocumentType.PAYMENT_RECEIPT,
      baseSnapshot,
      settings.receipt_prefix || 'RCT',
    );
    if (settings.business_gstin && settings.tax_sac_code) {
      await this.ensureDocument(
        order.id,
        order.userId,
        paid.id,
        undefined,
        DocumentType.GST_INVOICE,
        baseSnapshot,
        settings.invoice_prefix || 'INV',
      );
    }
    for (const refund of paid.refunds.filter(
      (item) => item.refundStatus === RefundStatus.SUCCESS,
    )) {
      await this.ensureDocument(
        order.id,
        order.userId,
        paid.id,
        refund.id,
        DocumentType.REFUND_CREDIT_NOTE,
        {
          ...baseSnapshot,
          refund: {
            amount: refund.amount.toFixed(2),
            reason: refund.reason,
            processedAt: refund.processedAt,
          },
        },
        settings.credit_note_prefix || 'CRN',
      );
    }
  }

  async generateOrderDocuments(orderId: string) {
    const owner = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });
    if (!owner) throw new NotFoundException('Order not found');
    const order = await this.loadDocumentOrder(orderId, owner.userId);
    await this.ensureDocuments(order);
  }

  private async ensureDocument(
    orderId: string,
    userId: string,
    paymentId: string,
    refundId: string | undefined,
    documentType: DocumentType,
    snapshot: Prisma.InputJsonValue,
    prefix: string,
  ) {
    const exists = await this.prisma.orderDocument.findFirst({
      where: { orderId, documentType, refundId: refundId ?? null },
    });
    if (exists) return exists;
    const number = `${prefix}-${new Date().getFullYear()}-${orderId.slice(0, 8).toUpperCase()}${refundId ? `-${refundId.slice(0, 4).toUpperCase()}` : ''}`;
    return this.prisma.orderDocument.create({
      data: {
        orderId,
        userId,
        paymentId,
        refundId,
        documentType,
        documentNumber: number,
        snapshot,
      },
    });
  }

  private snapshot(
    order: Awaited<ReturnType<OperationsService['loadDocumentOrder']>>,
    settings: Record<string, string>,
  ) {
    return {
      business: {
        legalName:
          settings.business_legal_name || documentBusinessDefaults.legalName,
        tradeName:
          settings.business_trade_name || documentBusinessDefaults.tradeName,
        address: settings.business_address || '',
        gstin: settings.business_gstin || '',
        stateCode: settings.business_state_code || '',
        supportEmail: settings.business_support_email || '',
        supportPhone: settings.business_support_phone || '',
        sacCode: settings.tax_sac_code || '',
        legalFooter: settings.invoice_legal_footer || '',
      },
      order: {
        orderNumber: order.orderNumber,
        packageName: order.packageName,
        guestCount: order.guestCount,
        finalPerPlatePrice: order.finalPerPlatePrice.toFixed(2),
        basePerPlatePrice: order.basePerPlatePrice.toFixed(2),
        customizationCharges: order.totalCustomizationCharges.toFixed(2),
        deliveryFee: order.deliveryFee.toFixed(2),
        totalAmount: order.totalAmount.toFixed(2),
        createdAt: order.createdAt,
        eventDate: order.eventDate,
        address: order.address,
        customer: {
          name: order.user.name,
          mobileNumber: order.user.mobileNumber,
          email: order.user.email,
        },
        payment: order.payments[0] ? {
          reference: order.payments[0].razorpayPaymentId,
          method: order.payments[0].paymentMethod,
          paidAt: order.payments[0].paidAt,
        } : null,
        items: order.selectedItems.map((item) => ({
          name: item.menuItemName,
          category: item.categoryName,
          role: item.role,
          itemPrice: item.itemPrice.toFixed(2),
          adjustmentAmount: item.adjustmentAmount.toFixed(2),
        })),
      },
      tax: {
        cgstRate: settings.tax_cgst_rate || '0',
        sgstRate: settings.tax_sgst_rate || '0',
        igstRate: settings.tax_igst_rate || '0',
      },
    };
  }

  private renderPdf(
    type: DocumentType,
    number: string,
    snapshot: Prisma.JsonValue,
  ) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const document = new PDFDocument({ margin: 48, size: 'A4' });
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      const data = snapshot as unknown as PdfSnapshot;
      document
        .fontSize(20)
        .text(data.business.tradeName || data.business.legalName);
      document
        .fontSize(10)
        .fillColor('#555')
        .text(data.business.address || '');
      document
        .moveDown()
        .fillColor('#111')
        .fontSize(16)
        .text(type === DocumentType.PAYMENT_RECEIPT ? 'INVOICE / PAYMENT RECEIPT' : type.replaceAll('_', ' '));
      document.fontSize(10).text(`Document: ${number}`);
      document.text(`Order: ${data.order.orderNumber}`);
      document.text(
        `Customer: ${data.order.customer.name || data.order.customer.mobileNumber}`,
      );
      document.text(`Mobile: ${data.order.customer.mobileNumber}`);
      if (data.order.customer.email) document.text(`Email: ${data.order.customer.email}`);
      document.text(
        `Event date: ${new Date(data.order.eventDate).toLocaleDateString('en-IN')}`,
      );
      document
        .moveDown()
        .fontSize(12)
        .text(`${data.order.packageName} for ${data.order.guestCount} guests`);
      document.fontSize(10).text(`Venue: ${data.order.address.addressLine1}, ${data.order.address.city}, ${data.order.address.state} ${data.order.address.pincode}`);
      document.moveDown().fontSize(11).text('Selected items');
      for (const item of data.order.items) {
        document.fontSize(9).text(`${item.name} — ${item.category} (${item.role}) — INR ${item.itemPrice}`);
      }
      document.moveDown().fontSize(10).text(`Base per pax: INR ${data.order.basePerPlatePrice}`);
      document.text(`Customization per pax: INR ${data.order.customizationCharges}`);
      document.text(`Final per pax: INR ${data.order.finalPerPlatePrice}`);
      document.text(`Delivery fee: INR ${data.order.deliveryFee}`);
      document.text(`Total paid: INR ${data.order.totalAmount}`);
      if (data.order.payment?.reference) document.text(`Payment reference: ${data.order.payment.reference}`);
      if (data.refund) document.text(`Refund: INR ${data.refund.amount}`);
      if (type === DocumentType.GST_INVOICE) {
        document.moveDown().fontSize(10).text(`GSTIN: ${data.business.gstin}`);
        document.text(`SAC: ${data.business.sacCode}`);
        document.text(
          `CGST: ${data.tax.cgstRate}%  SGST: ${data.tax.sgstRate}%  IGST: ${data.tax.igstRate}%`,
        );
      }
      document
        .moveDown()
        .fillColor('#555')
        .text(data.business.legalFooter || 'Computer-generated document.');
      document.end();
    });
  }

  private async assertAdminOrder(admin: JwtPayload, orderId: string) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, ...(regionId ? { regionId } : {}) },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');
  }

}
