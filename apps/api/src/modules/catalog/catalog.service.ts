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

  async updateOffering(code: OrderingOfferingCode, dto: UpdateOrderingOfferingDto) {
    const current = await this.prisma.orderingOffering.findUnique({ where: { code } });
    if (!current) throw new NotFoundException('Ordering offering not found');
    return this.prisma.orderingOffering.update({
      where: { code },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
