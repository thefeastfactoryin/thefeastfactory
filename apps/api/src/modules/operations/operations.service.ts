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
    stateCode: string;
    supportEmail: string;
    supportPhone: string;
    sacCode: string;
    legalFooter: string;
  };
  booking: {
    bookingNumber: string;
    itemsSubtotal: string;
    cutleryTotal: string;
    deliveryFee: string;
    totalAmount: string;
    amountPaid?: string;
    balanceDue?: string;
    createdAt: string | Date;
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
    payments?: Array<{
      amount: string;
      reference?: string | null;
      method?: string | null;
      paidAt?: string | Date | null;
      status: string;
    }>;
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
  refund?: {
    amount: string;
    reason?: string | null;
    processedAt?: string | Date | null;
  };
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

  async addNote(
    admin: JwtPayload,
    bookingId: string,
    dto: CreateBookingNoteDto,
  ) {
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
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
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
        document.generatedAt,
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
    if (
      booking.status === BookingStatus.COMPLETED &&
      settings.business_gstin &&
      settings.tax_sac_code
    ) {
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
    const successfulPayments = booking.payments.filter(
      (item) =>
        item.paymentStatus === PaymentStatus.PAID ||
        item.paymentStatus === PaymentStatus.REFUNDED,
    );
    const amountPaid = successfulPayments.reduce(
      (total, item) => total + Number(item.amount),
      0,
    );
    const totalAmount = Number(booking.totalAmount);

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
        amountPaid: amountPaid.toFixed(2),
        balanceDue: Math.max(totalAmount - amountPaid, 0).toFixed(2),
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
              reference: payment.externalReference || payment.razorpayPaymentId,
              method: payment.paymentMethod,
              paidAt: payment.paidAt,
            }
          : null,
        payments: successfulPayments.map((item) => ({
          amount: item.amount.toFixed(2),
          reference: item.externalReference || item.razorpayPaymentId,
          method: item.paymentMethod,
          paidAt: item.paidAt,
          status: item.paymentStatus,
        })),
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
    generatedAt: Date,
  ) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const document = new PDFDocument({
        margins: { top: 40, right: 40, bottom: 20, left: 40 },
        size: 'A4',
      });
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      const data = snapshot as unknown as PdfSnapshot;

      const colors = {
        maroon: '#761B2A',
        maroonDark: '#4A0D17',
        gold: '#D2A33A',
        ivory: '#FAF5EA',
        ink: '#241C18',
        muted: '#6D625B',
        border: '#E4D9CC',
        green: '#247A52',
        white: '#FFFFFF',
      };
      const pageWidth = document.page.width;
      const pageHeight = document.page.height;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      const footerTop = pageHeight - 42;
      const title =
        type === DocumentType.PAYMENT_RECEIPT
          ? 'PAYMENT RECEIPT'
          : type === DocumentType.GST_INVOICE
            ? 'TAX INVOICE'
            : 'REFUND CREDIT NOTE';
      const statusLabel =
        type === DocumentType.PAYMENT_RECEIPT
          ? 'PAYMENT CONFIRMED'
          : type === DocumentType.GST_INVOICE
            ? 'ORIGINAL FOR RECIPIENT'
            : 'REFUND PROCESSED';

      const money = (value: string | number | null | undefined) => {
        const amount = Number(value ?? 0);
        return `INR ${new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number.isFinite(amount) ? amount : 0)}`;
      };
      const date = (value: string | Date | null | undefined) => {
        if (!value) return '-';
        return new Intl.DateTimeFormat('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        }).format(new Date(value));
      };
      const sentenceCase = (value?: string | null) =>
        value
          ? value
              .replaceAll('_', ' ')
              .toLowerCase()
              .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
          : '-';

      const drawFooter = () => {
        document
          .moveTo(margin, footerTop)
          .lineTo(pageWidth - margin, footerTop)
          .lineWidth(0.6)
          .strokeColor(colors.border)
          .stroke();
        document
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(colors.muted)
          .text(
            [data.business.supportEmail, data.business.supportPhone]
              .filter(Boolean)
              .join('  |  ') || 'thefeastfactory.in',
            margin,
            footerTop + 10,
            { width: contentWidth / 2 },
          )
          .text(
            `Booking ${data.booking.bookingNumber}  |  ${number}`,
            margin + contentWidth / 2,
            footerTop + 10,
            { width: contentWidth / 2, align: 'right' },
          );
      };

      const drawContinuationHeader = () => {
        document.rect(0, 0, pageWidth, 7).fill(colors.gold);
        document
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(colors.maroon)
          .text(data.business.tradeName || data.business.legalName, margin, 25);
        document
          .font('Helvetica')
          .fontSize(8)
          .fillColor(colors.muted)
          .text(`${title} - ${number} - continued`, margin, 43);
        document.y = 70;
      };

      const ensureSpace = (height: number) => {
        if (document.y + height <= footerTop - 16) return;
        drawFooter();
        document.addPage();
        drawContinuationHeader();
      };

      const drawMainHeader = () => {
        document.rect(0, 0, pageWidth, 10).fill(colors.gold);
        document.rect(0, 10, pageWidth, 105).fill(colors.maroon);
        document.circle(67, 61, 23).fill(colors.gold);
        document
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(colors.white)
          .text('TFF', 45, 56, { width: 44, align: 'center' });
        document
          .font('Times-Bold')
          .fontSize(20)
          .fillColor(colors.white)
          .text(data.business.tradeName || data.business.legalName, 103, 38, {
            width: 260,
          });
        document
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#F2DFA9')
          .text('CELEBRATIONS, CATERED BEAUTIFULLY', 104, 67, {
            characterSpacing: 0.9,
          });
        document
          .font('Helvetica-Bold')
          .fontSize(17)
          .fillColor(colors.white)
          .text(title, 360, 37, { width: 195, align: 'right' });
        document
          .roundedRect(409, 68, 146, 21, 10)
          .fill(
            type === DocumentType.REFUND_CREDIT_NOTE ? colors.gold : '#8D2B3A',
          );
        document
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(colors.white)
          .text(statusLabel, 414, 75, { width: 136, align: 'center' });

        document.rect(0, 115, pageWidth, 56).fill(colors.ivory);
        const meta = [
          ['DOCUMENT NO.', number],
          ['ISSUE DATE', date(generatedAt)],
          ['BOOKING NO.', data.booking.bookingNumber],
          ['EVENT DATE', date(data.booking.eventDate)],
        ];
        meta.forEach(([label, value], index) => {
          const width = contentWidth / 4;
          const x = margin + index * width;
          document
            .font('Helvetica-Bold')
            .fontSize(6.5)
            .fillColor(colors.muted)
            .text(label, x, 128, { width: width - 8 });
          document
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(colors.ink)
            .text(value, x, 143, { width: width - 8 });
        });
        document.y = 190;
      };

      const drawInfoCard = (
        x: number,
        y: number,
        width: number,
        heading: string,
        lines: string[],
      ) => {
        document
          .roundedRect(x, y, width, 96, 8)
          .fillAndStroke(colors.white, colors.border);
        document
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(colors.maroon)
          .text(heading.toUpperCase(), x + 13, y + 12, { width: width - 26 });
        let lineY = y + 29;
        lines
          .filter(Boolean)
          .slice(0, 5)
          .forEach((line, index) => {
            const lineWidth = width - 26;
            const maxHeight = index === 0 ? 13 : 18;
            const lineHeight = Math.min(
              document.heightOfString(line, { width: lineWidth }),
              maxHeight,
            );
            document
              .font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(index === 0 ? 9 : 7.8)
              .fillColor(index === 0 ? colors.ink : colors.muted)
              .text(line, x + 13, lineY, {
                width: lineWidth,
                height: maxHeight,
                ellipsis: true,
              });
            lineY += lineHeight + 4;
          });
      };

      const supplierLines = [
        data.business.legalName,
        data.business.address || 'Business address not configured',
        data.business.gstin ? `GSTIN: ${data.business.gstin}` : '',
        data.business.stateCode ? `State code: ${data.business.stateCode}` : '',
      ];
      const customerLines = [
        data.booking.customer.name || data.booking.customer.mobileNumber,
        data.booking.address.addressLine1,
        `${data.booking.address.city}, ${data.booking.address.state} - ${data.booking.address.pincode}`,
        type === DocumentType.GST_INVOICE
          ? 'Recipient GSTIN: Not provided (B2C)'
          : `Mobile: ${data.booking.customer.mobileNumber}`,
        type === DocumentType.GST_INVOICE
          ? `Mobile: ${data.booking.customer.mobileNumber}`
          : data.booking.customer.email
            ? `Email: ${data.booking.customer.email}`
            : '',
      ];

      drawMainHeader();
      const infoY = document.y;
      drawInfoCard(margin, infoY, 250, 'Issued by', supplierLines);
      drawInfoCard(
        margin + 265,
        infoY,
        250,
        'Billed / delivered to',
        customerLines,
      );
      document.y = infoY + 114;

      if (type === DocumentType.PAYMENT_RECEIPT && data.booking.payment) {
        const payment = data.booking.payment;
        const paymentY = document.y;
        document
          .roundedRect(margin, paymentY, contentWidth, 74, 10)
          .fill(colors.maroon);
        document
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#F2DFA9')
          .text('AMOUNT RECEIVED', margin + 16, paymentY + 13);
        document
          .font('Helvetica-Bold')
          .fontSize(22)
          .fillColor(colors.white)
          .text(money(payment.amount), margin + 16, paymentY + 29, {
            width: 205,
          });
        const details = [
          ['PAID ON', date(payment.paidAt)],
          ['METHOD', sentenceCase(payment.method)],
          ['REFERENCE', payment.reference || '-'],
        ];
        details.forEach(([label, value], index) => {
          const x = margin + 235 + index * 91;
          document
            .font('Helvetica-Bold')
            .fontSize(6.3)
            .fillColor('#F2DFA9')
            .text(label, x, paymentY + 16, { width: 82 });
          document
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(colors.white)
            .text(value, x, paymentY + 32, {
              width: 82,
              height: 24,
              ellipsis: true,
            });
        });
        document.y = paymentY + 92;
      }

      if (type === DocumentType.REFUND_CREDIT_NOTE && data.refund) {
        const refundY = document.y;
        document
          .roundedRect(margin, refundY, contentWidth, 64, 10)
          .fill(colors.ivory);
        document
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(colors.maroon)
          .text('REFUND AMOUNT', margin + 15, refundY + 13);
        document
          .font('Helvetica-Bold')
          .fontSize(19)
          .fillColor(colors.ink)
          .text(money(data.refund.amount), margin + 15, refundY + 30);
        document
          .font('Helvetica')
          .fontSize(8)
          .fillColor(colors.muted)
          .text(
            `Processed: ${date(data.refund.processedAt)}\nReason: ${data.refund.reason || 'Not specified'}`,
            margin + 285,
            refundY + 17,
            { width: 210, align: 'right' },
          );
        document.y = refundY + 82;
      }

      const tableColumns = [
        { label: 'DESCRIPTION', x: margin, width: 220, align: 'left' as const },
        {
          label: type === DocumentType.GST_INVOICE ? 'SAC' : 'ORDER REF',
          x: margin + 220,
          width: 70,
          align: 'left' as const,
        },
        { label: 'QTY', x: margin + 290, width: 55, align: 'right' as const },
        { label: 'RATE', x: margin + 345, width: 80, align: 'right' as const },
        {
          label: 'AMOUNT',
          x: margin + 425,
          width: 90,
          align: 'right' as const,
        },
      ];
      const drawTableHeader = () => {
        ensureSpace(32);
        const y = document.y;
        document
          .roundedRect(margin, y, contentWidth, 25, 5)
          .fill(colors.maroon);
        tableColumns.forEach((column) => {
          document
            .font('Helvetica-Bold')
            .fontSize(6.7)
            .fillColor(colors.white)
            .text(column.label, column.x + 8, y + 9, {
              width: column.width - 16,
              align: column.align,
            });
        });
        document.y = y + 25;
      };
      const drawTableRow = (values: string[], shaded: boolean) => {
        const descriptionHeight = document.heightOfString(values[0], {
          width: tableColumns[0].width - 16,
        });
        const rowHeight = Math.max(32, descriptionHeight + 18);
        if (document.y + rowHeight > footerTop - 16) {
          drawFooter();
          document.addPage();
          drawContinuationHeader();
          drawTableHeader();
        }
        const y = document.y;
        if (shaded)
          document.rect(margin, y, contentWidth, rowHeight).fill('#FCF9F3');
        document
          .moveTo(margin, y + rowHeight)
          .lineTo(pageWidth - margin, y + rowHeight)
          .lineWidth(0.5)
          .strokeColor(colors.border)
          .stroke();
        values.forEach((value, index) => {
          const column = tableColumns[index];
          document
            .font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(index === 0 ? 8.2 : 7.6)
            .fillColor(index === 0 ? colors.ink : colors.muted)
            .text(value, column.x + 8, y + 10, {
              width: column.width - 16,
              align: column.align,
            });
        });
        document.y = y + rowHeight;
      };

      if (type !== DocumentType.PAYMENT_RECEIPT) {
        document
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(colors.ink)
          .text('ORDER SUMMARY', margin, document.y, { characterSpacing: 0.5 });
        document.y += 18;
        drawTableHeader();
        data.booking.packages.forEach((orderedPackage, index) => {
          const isKg = orderedPackage.guestCount == null;
          drawTableRow(
            [
              `${orderedPackage.packageName}\n${isKg ? 'Bulk dishes by weight' : `Catering for ${orderedPackage.guestCount} guests`}`,
              type === DocumentType.GST_INVOICE
                ? data.business.sacCode || '-'
                : orderedPackage.orderNumber,
              isKg ? 'KG' : String(orderedPackage.guestCount),
              !isKg && orderedPackage.finalPerPlatePrice
                ? money(orderedPackage.finalPerPlatePrice)
                : '-',
              money(orderedPackage.totalAmount),
            ],
            index % 2 === 1,
          );
        });
        if (Number(data.booking.cutleryTotal) > 0) {
          drawTableRow(
            [
              'Cutlery and serving essentials',
              type === DocumentType.GST_INVOICE
                ? data.business.sacCode || '-'
                : '-',
              '1',
              money(data.booking.cutleryTotal),
              money(data.booking.cutleryTotal),
            ],
            data.booking.packages.length % 2 === 1,
          );
        }
        if (Number(data.booking.deliveryFee) > 0) {
          drawTableRow(
            [
              'Delivery and handling',
              type === DocumentType.GST_INVOICE
                ? data.business.sacCode || '-'
                : '-',
              '1',
              money(data.booking.deliveryFee),
              money(data.booking.deliveryFee),
            ],
            data.booking.packages.length % 2 === 0,
          );
        }
        document.y += 16;
      } else {
        document
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(colors.ink)
          .text('BOOKING PAYMENT SUMMARY', margin, document.y, {
            characterSpacing: 0.5,
          });
        document.y += 20;
      }

      const cgstRate = Number(data.tax.cgstRate || 0);
      const sgstRate = Number(data.tax.sgstRate || 0);
      const igstRate = Number(data.tax.igstRate || 0);
      const totalTaxRate = cgstRate + sgstRate + igstRate;
      const grandTotal = Number(data.booking.totalAmount);
      const taxableValue =
        type === DocumentType.GST_INVOICE && totalTaxRate > 0
          ? grandTotal / (1 + totalTaxRate / 100)
          : grandTotal;
      const taxRows = [
        ...(cgstRate > 0
          ? [[`CGST (${cgstRate}%)`, taxableValue * (cgstRate / 100)] as const]
          : []),
        ...(sgstRate > 0
          ? [[`SGST (${sgstRate}%)`, taxableValue * (sgstRate / 100)] as const]
          : []),
        ...(igstRate > 0
          ? [[`IGST (${igstRate}%)`, taxableValue * (igstRate / 100)] as const]
          : []),
      ];
      const summaryHeight =
        type === DocumentType.GST_INVOICE ? 108 + taxRows.length * 18 : 92;
      ensureSpace(summaryHeight + 18);
      const summaryX = margin + 275;
      const summaryY = document.y;
      document
        .roundedRect(summaryX, summaryY, 240, summaryHeight, 8)
        .fillAndStroke(colors.ivory, colors.border);
      let totalY = summaryY + 13;
      const totalLine = (
        label: string,
        value: number | string,
        strong = false,
      ) => {
        document
          .font(strong ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(strong ? 9.5 : 8)
          .fillColor(strong ? colors.ink : colors.muted)
          .text(label, summaryX + 14, totalY, { width: 105 });
        document.text(
          typeof value === 'string' ? value : money(value),
          summaryX + 118,
          totalY,
          { width: 108, align: 'right' },
        );
        totalY += strong ? 22 : 18;
      };
      if (type === DocumentType.GST_INVOICE) {
        totalLine('Taxable value', taxableValue);
        taxRows.forEach(([label, value]) => totalLine(label, value));
      } else {
        totalLine('Items subtotal', Number(data.booking.itemsSubtotal));
        totalLine('Cutlery', Number(data.booking.cutleryTotal));
        totalLine('Delivery', Number(data.booking.deliveryFee));
      }
      document
        .moveTo(summaryX + 14, totalY - 3)
        .lineTo(summaryX + 226, totalY - 3)
        .lineWidth(0.7)
        .strokeColor(colors.border)
        .stroke();
      totalLine('TOTAL', grandTotal, true);
      if (type === DocumentType.GST_INVOICE && totalTaxRate > 0) {
        document
          .font('Helvetica')
          .fontSize(6.7)
          .fillColor(colors.muted)
          .text(
            'GST is included in the total shown above.',
            summaryX + 14,
            totalY,
            {
              width: 212,
            },
          );
      }

      const amountPaid = Number(
        data.booking.amountPaid ?? data.booking.payment?.amount ?? 0,
      );
      const balanceDue = Number(
        data.booking.balanceDue ?? Math.max(grandTotal - amountPaid, 0),
      );
      document
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(colors.maroon)
        .text(
          type === DocumentType.GST_INVOICE
            ? 'PAYMENT STATUS'
            : 'BOOKING STATUS',
          margin,
          summaryY + 4,
        );
      document
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(balanceDue <= 0 ? colors.green : colors.ink)
        .text(
          balanceDue <= 0 ? 'PAID IN FULL' : 'PARTIALLY PAID',
          margin,
          summaryY + 20,
        );
      document
        .font('Helvetica')
        .fontSize(8)
        .fillColor(colors.muted)
        .text(`Paid to date: ${money(amountPaid)}`, margin, summaryY + 41)
        .text(`Balance due: ${money(balanceDue)}`, margin, summaryY + 57);
      document.y = summaryY + summaryHeight + 20;

      if (type === DocumentType.GST_INVOICE) {
        ensureSpace(72);
        const complianceY = document.y;
        document
          .roundedRect(margin, complianceY, contentWidth, 58, 7)
          .fillAndStroke(colors.white, colors.border);
        const compliance = [
          `SAC: ${data.business.sacCode || '-'}`,
          `Place of supply: ${data.booking.address.state}`,
          'Reverse charge: No',
        ];
        compliance.forEach((value, index) => {
          document
            .font('Helvetica-Bold')
            .fontSize(7.5)
            .fillColor(colors.ink)
            .text(value, margin + 14 + index * 167, complianceY + 18, {
              width: 155,
              align: index === 2 ? 'right' : 'left',
            });
        });
        document
          .font('Helvetica')
          .fontSize(6.8)
          .fillColor(colors.muted)
          .text(
            'Electronically generated tax invoice - no physical signature required.',
            margin + 14,
            complianceY + 37,
            { width: contentWidth - 28 },
          );
        document.y = complianceY + 66;
      }

      if (type !== DocumentType.GST_INVOICE) {
        ensureSpace(58);
        const noteY = document.y;
        document
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(colors.maroon)
          .text('NOTES', margin, noteY);
        document
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(colors.muted)
          .text(
            data.business.legalFooter ||
              'This is a computer-generated document and does not require a physical signature.',
            margin,
            noteY + 15,
            { width: 300, lineGap: 2 },
          );
        document
          .moveTo(pageWidth - margin - 150, noteY + 34)
          .lineTo(pageWidth - margin, noteY + 34)
          .lineWidth(0.6)
          .strokeColor(colors.border)
          .stroke();
        document
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(colors.ink)
          .text(
            'For ' + (data.business.tradeName || data.business.legalName),
            pageWidth - margin - 185,
            noteY + 43,
            { width: 185, align: 'right' },
          );
        document
          .font('Helvetica')
          .fontSize(7)
          .fillColor(colors.muted)
          .text('Authorised signatory', pageWidth - margin - 185, noteY + 57, {
            width: 185,
            align: 'right',
          });
      }

      drawFooter();
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
