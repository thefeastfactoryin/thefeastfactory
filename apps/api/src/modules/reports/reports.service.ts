import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: OperatingRegionsService,
  ) {}

  async revenue(admin: JwtPayload, requestedRegionId?: string) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      requestedRegionId,
    );
    const paymentWhere = regionId ? { order: { regionId } } : {};
    const [paid, refunded] = await Promise.all([
      this.prisma.payment.aggregate({
        // Gross revenue is the amount successfully captured before refunds.
        // Fully refunded ledgers remain part of gross and are offset below.
        where: {
          paymentStatus: {
            in: [PaymentStatus.PAID, PaymentStatus.REFUNDED],
          },
          ...paymentWhere,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.refund.aggregate({
        where: {
          refundStatus: 'SUCCESS',
          ...(regionId ? { payment: { order: { regionId } } } : {}),
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    const gross = paid._sum.amount ?? 0;
    const refunds = refunded._sum.amount ?? 0;
    return {
      grossRevenue: gross.toString(),
      refundedAmount: refunds.toString(),
      netRevenue: Number(gross) - Number(refunds),
      paidPayments: paid._count,
    };
  }

  async orders(admin: JwtPayload, requestedRegionId?: string) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      requestedRegionId,
    );
    const orderWhere = regionId ? { regionId } : {};
    const [byStatus, popularItems, total] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['orderStatus'],
        where: orderWhere,
        _count: true,
      }),
      this.prisma.orderSelectedItem.groupBy({
        by: ['menuItemName'],
        where: regionId ? { order: { regionId } } : {},
        _count: true,
        orderBy: { _count: { menuItemName: 'desc' } },
        take: 10,
      }),
      this.prisma.order.count({ where: orderWhere }),
    ]);
    return { total, byStatus, popularItems };
  }

  async payments(admin: JwtPayload, requestedRegionId?: string) {
    const regionId = await this.regions.resolveAdminScope(
      admin,
      requestedRegionId,
    );
    const paymentWhere = regionId ? { order: { regionId } } : {};
    const [byStatus, total] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['paymentStatus'],
        where: paymentWhere,
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.payment.count({ where: paymentWhere }),
    ]);
    return {
      total,
      byStatus: byStatus.map((row) => ({
        paymentStatus: row.paymentStatus,
        count: row._count,
        amount: row._sum.amount?.toFixed(2) ?? '0.00',
      })),
    };
  }
}
