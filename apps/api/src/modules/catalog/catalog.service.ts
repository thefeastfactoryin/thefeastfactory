import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderingOfferingCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOrderingOfferingDto } from './dto/update-ordering-offering.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listOfferings(publicOnly = true) {
    return this.prisma.orderingOffering.findMany({
      where: publicOnly ? { isActive: true } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async publicSettings() {
    const keys = [
      'min_booking_lead_hours',
      'event_service_start_time',
      'event_service_end_time',
      'event_time_interval_minutes',
      'business_legal_name',
      'business_trade_name',
      'business_address',
      'business_gstin',
      'business_support_email',
      'business_support_phone',
    ];
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: keys } },
    });
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return {
      minBookingLeadHours: Number.parseInt(settings.min_booking_lead_hours ?? '48', 10),
      eventServiceStartTime: settings.event_service_start_time ?? '06:00',
      eventServiceEndTime: settings.event_service_end_time ?? '23:30',
      eventTimeIntervalMinutes: Number.parseInt(
        settings.event_time_interval_minutes ?? '30',
        10,
      ),
      business: {
        legalName: settings.business_legal_name ?? null,
        tradeName: settings.business_trade_name ?? null,
        address: settings.business_address ?? null,
        gstin: settings.business_gstin ?? null,
        supportEmail: settings.business_support_email ?? null,
        supportPhone: settings.business_support_phone ?? null,
      },
    };
  }

  async updateOffering(code: OrderingOfferingCode, dto: UpdateOrderingOfferingDto) {
    const current = await this.prisma.orderingOffering.findUnique({ where: { code } });
    if (!current) throw new NotFoundException('Ordering offering not found');
    return this.prisma.orderingOffering.update({
      where: { code },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl.trim() || null } : {}),
        ...(dto.ctaLabel !== undefined ? { ctaLabel: dto.ctaLabel.trim() || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
