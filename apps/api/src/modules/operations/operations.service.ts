import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  DocumentType,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import PDFDocument from 'pdfkit';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingNoteDto } from './dto/create-booking-note.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  clockMinutes,
  positiveIntegerSetting,
} from '../../common/setting-values';

const editableSettings = new Set([
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
  booking: {
    bookingNumber: string;
    itemsSubtotal: string;
    cutleryTotal: string;
    deliveryFee: string;
    totalAmount: string;
    eventDate: string | Date;
    address: {
      addressLine1: string;
      city: string;
      state: string;
      pincode: string;
    };
    customer: {
      name?: string | null;
      mobileNumber: string;
      email?: string | null;
    };
    payment?: {
      amount: string;
      reference?: string | null;
      method?: string | null;
      paidAt?: string | Date | null;
    } | null;
    packages: Array<{
      orderNumber: string;
      packageName: string;
      guestCount: number | null;
      finalPerPlatePrice: string | null;
      totalAmount: string;
      items: Array<{
        weightGrams?: number | null;
        pricePerKg?: string | null;
        lineTotal?: string | null;
        name: string;
        category: string;
        role: string;
        itemPrice: string;
        adjustmentAmount: string;
      }>;
    }>;
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

  async notes(admin: JwtPayload, bookingId: string) {
    await this.assertAdminBooking(admin, bookingId);
    return this.prisma.bookingNote.findMany({
      where: { bookingId },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addNote(admin: JwtPayload, bookingId: string, dto: CreateBookingNoteDto) {
    await this.assertAdminBooking(admin, bookingId);
    return this.prisma.bookingNote.create({
      data: { bookingId, authorId: admin.sub, body: dto.body.trim() },
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
    const bookings = await this.prisma.booking.findMany({
      where: {
        eventDate: { gte: start, lte: end },
        status: { not: BookingStatus.PENDING_PAYMENT },
        ...(regionId ? { regionId } : {}),
        ...(city
          ? { city: { contains: city, mode: 'insensitive' } }
          : {}),
      },
      include: {
        region: true,
        user: { select: { id: true, name: true, mobileNumber: true } },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            orderStatus: true,
            paymentStatus: true,
            guestCount: true,
          },
        },
      },
      orderBy: [{ eventDate: 'asc' }, { eventTimeStart: 'asc' }],
    });
    return bookings.map((booking) => this.serializeOperationsBooking(booking));
  }

  async queue(admin: JwtPayload, requestedRegionId?: string) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      requestedRegionId,
    );
    const now = new Date();
    const upcoming = new Date(now.getTime() + 7 * 86_400_000);
    const [events, failedPayments, pendingRefunds] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          eventDate: { gte: now, lte: upcoming },
          status: {
            notIn: [
              BookingStatus.CANCELLED,
              BookingStatus.DECLINED,
              BookingStatus.AWAITING_APPROVAL,
              BookingStatus.PENDING_PAYMENT,
            ],
          },
          ...(regionId ? { regionId } : {}),
        },
        include: {
          region: true,
          user: true,
          orders: {
            select: {
              id: true,
              orderNumber: true,
              orderStatus: true,
              paymentStatus: true,
              guestCount: true,
            },
          },
        },
        orderBy: { eventDate: 'asc' },
        take: 30,
      }),
      this.prisma.payment.findMany({
        where: {
          paymentStatus: PaymentStatus.FAILED,
          ...(regionId ? { booking: { regionId } } : {}),
        },
        include: {
          booking: { include: { user: true, region: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.refund.findMany({
        where: {
          refundStatus: {
            in: [RefundStatus.INITIATED, RefundStatus.PROCESSING],
          },
          ...(regionId ? { payment: { booking: { regionId } } } : {}),
        },
        include: {
          payment: {
            include: {
              booking: { include: { region: true } },
            },
          },
        },
        orderBy: { initiatedAt: 'asc' },
        take: 20,
      }),
    ]);
    return {
      upcomingEvents: events.map((booking) =>
        this.serializeOperationsBooking(booking),
      ),
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
    for (const key of ['event_service_start_time', 'event_service_end_time']) {
      if (
        settings[key] !== undefined &&
        clockMinutes(settings[key]) === undefined
      ) {
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

  async documents(userId: string, bookingId: string, admin?: JwtPayload) {
    const booking = await this.loadDocumentBooking(bookingId, userId, admin);
    await this.ensureDocuments(booking);
    return this.prisma.bookingDocument.findMany({
      where: { bookingId },
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
    bookingId: string,
    documentId: string,
    admin?: JwtPayload,
  ) {
    await this.loadDocumentBooking(bookingId, userId, admin);
    const document = await this.prisma.bookingDocument.findFirst({
      where: { id: documentId, bookingId },
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

  private async loadDocumentBooking(
    bookingId: string,
    userId: string,
    admin?: JwtPayload,
  ) {
    const regionId = admin
      ? await this.regions.resolveAdminScope(admin)
      : undefined;
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        ...(admin ? (regionId ? { regionId } : {}) : { userId }),
      },
      include: {
        user: true,
        cutleryItems: true,
        orders: {
          include: { selectedItems: true },
          orderBy: { createdAt: 'asc' },
        },
        payments: { include: { refunds: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private async ensureDocuments(
    booking: Awaited<ReturnType<OperationsService['loadDocumentBooking']>>,
  ) {
    const paidPayments = booking.payments.filter(
      (payment) =>
        payment.paymentStatus === PaymentStatus.PAID ||
        payment.paymentStatus === PaymentStatus.REFUNDED,
    );
    if (!paidPayments.length) return;
    const settings = Object.fromEntries(
      (await this.settings()).map((setting) => [setting.key, setting.value]),
    );
    for (const payment of paidPayments) {
      const paymentSnapshot = this.snapshot(booking, settings, payment);
      await this.ensureDocument(
        booking.id,
        booking.userId,
        payment.id,
        undefined,
        DocumentType.PAYMENT_RECEIPT,
        paymentSnapshot,
        settings.receipt_prefix || 'RCT',
      );
      for (const refund of payment.refunds.filter(
        (item) => item.refundStatus === RefundStatus.SUCCESS,
      )) {
        await this.ensureDocument(
          booking.id,
          booking.userId,
          payment.id,
          refund.id,
          DocumentType.REFUND_CREDIT_NOTE,
          {
            ...paymentSnapshot,
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
    if (settings.business_gstin && settings.tax_sac_code) {
      const latestPayment = paidPayments.at(-1)!;
      await this.ensureDocument(
        booking.id,
        booking.userId,
        latestPayment.id,
        undefined,
        DocumentType.GST_INVOICE,
        this.snapshot(booking, settings),
        settings.invoice_prefix || 'INV',
      );
    }
  }

  async generateBookingDocuments(bookingId: string) {
    const owner = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true },
    });
    if (!owner) throw new NotFoundException('Booking not found');
    const booking = await this.loadDocumentBooking(bookingId, owner.userId);
    await this.ensureDocuments(booking);
  }

  private async ensureDocument(
    bookingId: string,
    userId: string,
    paymentId: string,
    refundId: string | undefined,
    documentType: DocumentType,
    snapshot: Prisma.InputJsonValue,
    prefix: string,
  ) {
    const exists = await this.prisma.bookingDocument.findFirst({
      where: {
        bookingId,
        documentType,
        ...(documentType === DocumentType.PAYMENT_RECEIPT ? { paymentId } : {}),
        refundId: refundId ?? null,
      },
    });
    if (exists) return exists;
    const number = `${prefix}-${new Date().getFullYear()}-${bookingId.slice(0, 8).toUpperCase()}-${paymentId.slice(0, 4).toUpperCase()}${refundId ? `-${refundId.slice(0, 4).toUpperCase()}` : ''}`;
    return this.prisma.bookingDocument.create({
      data: {
        bookingId,
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
    booking: Awaited<ReturnType<OperationsService['loadDocumentBooking']>>,
    settings: Record<string, string>,
    payment?: (typeof booking.payments)[number],
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
      booking: {
        bookingNumber: booking.bookingNumber,
        itemsSubtotal: booking.itemsSubtotal.toFixed(2),
        cutleryTotal: booking.cutleryTotal.toFixed(2),
        deliveryFee: booking.deliveryFee.toFixed(2),
        totalAmount: booking.totalAmount.toFixed(2),
        createdAt: booking.createdAt,
        eventDate: booking.eventDate,
        address: {
          addressLine1: booking.addressLine1,
          city: booking.city,
          state: booking.state,
          pincode: booking.pincode,
        },
        customer: {
          name: booking.user.name,
          mobileNumber: booking.contactNumber,
          email: booking.user.email,
        },
        payment: payment
          ? {
              amount: payment.amount.toFixed(2),
              reference:
                payment.externalReference || payment.razorpayPaymentId,
              method: payment.paymentMethod,
              paidAt: payment.paidAt,
            }
          : null,
        packages: booking.orders.map((order) => ({
          orderNumber: order.orderNumber,
          packageName: order.packageName,
          guestCount: order.guestCount,
          finalPerPlatePrice: order.finalPerPlatePrice?.toFixed(2) ?? null,
          totalAmount: order.totalAmount.toFixed(2),
          items: order.selectedItems.map((item) => ({
            name: item.menuItemName,
            weightGrams: item.weightGrams,
            pricePerKg: item.pricePerKg?.toFixed(2) ?? null,
            lineTotal: item.lineTotal?.toFixed(2) ?? null,
            category: item.categoryName,
            role: item.role,
            itemPrice: item.itemPrice.toFixed(2),
            adjustmentAmount: item.adjustmentAmount.toFixed(2),
          })),
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
        .text(
          type === DocumentType.PAYMENT_RECEIPT
            ? 'INVOICE / PAYMENT RECEIPT'
            : type.replaceAll('_', ' '),
        );
      document.fontSize(10).text(`Document: ${number}`);
      document.text(`Booking: ${data.booking.bookingNumber}`);
      document.text(
        `Customer: ${data.booking.customer.name || data.booking.customer.mobileNumber}`,
      );
      document.text(`Mobile: ${data.booking.customer.mobileNumber}`);
      if (data.booking.customer.email)
        document.text(`Email: ${data.booking.customer.email}`);
      document.text(
        `Event date: ${new Date(data.booking.eventDate).toLocaleDateString('en-IN')}`,
      );
      document
        .moveDown()
        .fontSize(10)
        .text(
          `Venue: ${data.booking.address.addressLine1}, ${data.booking.address.city}, ${data.booking.address.state} ${data.booking.address.pincode}`,
        );
      for (const orderedPackage of data.booking.packages) {
        document
          .moveDown()
          .fontSize(12)
          .text(
            orderedPackage.guestCount == null
              ? `${orderedPackage.packageName} — Order by KG`
              : `${orderedPackage.packageName} for ${orderedPackage.guestCount} guests`,
          );
        document
          .fontSize(9)
          .fillColor('#555')
          .text(`Package ref: ${orderedPackage.orderNumber}`)
          .fillColor('#111');
        for (const item of orderedPackage.items) {
          document
            .fontSize(9)
            .text(
              item.weightGrams
                ? `${item.name} — ${item.weightGrams / 1000} kg x INR ${item.pricePerKg}/kg — INR ${item.lineTotal}`
                : `${item.name} — ${item.category} (${item.role}) — INR ${item.itemPrice}`,
            );
        }
        document
          .fontSize(10)
          .text(`Package total: INR ${orderedPackage.totalAmount}`);
      }
      document.moveDown().text(`Items subtotal: INR ${data.booking.itemsSubtotal}`);
      document.text(`Cutlery: INR ${data.booking.cutleryTotal}`);
      document.text(`Delivery fee: INR ${data.booking.deliveryFee}`);
      document.text(`Booking total: INR ${data.booking.totalAmount}`);
      if (data.booking.payment) {
        document.text(`Payment amount: INR ${data.booking.payment.amount}`);
        if (data.booking.payment.reference)
          document.text(
            `Payment reference: ${data.booking.payment.reference}`,
          );
      }
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

  private serializeOperationsBooking<
    T extends {
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      state: string;
      pincode: string;
      landmark: string | null;
      orders: Array<{ guestCount: number | null }>;
    },
  >(booking: T) {
    return {
      ...booking,
      address: {
        addressLine1: booking.addressLine1,
        addressLine2: booking.addressLine2,
        city: booking.city,
        state: booking.state,
        pincode: booking.pincode,
        landmark: booking.landmark,
      },
      guestCount: booking.orders.reduce(
        (total, order) => total + (order.guestCount ?? 0),
        0,
      ),
    };
  }

  private async assertAdminBooking(admin: JwtPayload, bookingId: string) {
    const regionId = await this.regions.resolveAdminScope(admin);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, ...(regionId ? { regionId } : {}) },
      select: { id: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
  }
}
