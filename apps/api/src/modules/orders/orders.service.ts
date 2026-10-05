import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  OperatingRegion,
  Order,
  OrderSelectedItem,
  OrderCutleryItem,
  OrderStatusHistory,
  User,
  UserAddress,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { storedEventTime } from '../../common/event-time';
import { OperatingRegionsService } from '../operating-regions/operating-regions.service';

type SerializableOrder = Order & {
  address?: UserAddress | null;
  region?: OperatingRegion | null;
  selectedItems?: OrderSelectedItem[];
  cutleryItems?: OrderCutleryItem[];
  statusHistory?: OrderStatusHistory[];
  user?: User;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: OperatingRegionsService,
  ) {}

  async get(userId: string, bookingId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, bookingId, booking: { userId } },
      include: {
        address: true,
        region: true,
        selectedItems: true,
        cutleryItems: true,
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.serializeOrder(order);
  }

  serializeOrder(order: SerializableOrder) {
    const region = order.region ? this.regions.serialize(order.region) : null;
    const selectedItems = order.selectedItems?.map((item) => ({
      ...item,
      itemPrice: item.itemPrice.toFixed(2),
      includedValue: item.includedValue.toFixed(2),
      adjustmentAmount: item.adjustmentAmount.toFixed(2),
      pricePerKg: item.pricePerKg?.toFixed(2) ?? null,
      lineTotal: item.lineTotal?.toFixed(2) ?? null,
      totalAdjustmentAmount:
        item.lineTotal?.toFixed(2) ??
        item.adjustmentAmount.mul(order.guestCount ?? 1).toFixed(2),
    }));
    const cutleryItems = order.cutleryItems?.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    }));
    const distanceKm = order.distanceKm?.toFixed(2) ?? null;
    const deliveryFee = order.deliveryFee.toFixed(2);
    return {
      ...order,
      contactNumber: order.contactNumber,
      basePerPlatePrice: order.basePerPlatePrice?.toFixed(2) ?? null,
      totalCustomizationCharges:
        order.totalCustomizationCharges?.toFixed(2) ?? null,
      finalPerPlatePrice: order.finalPerPlatePrice?.toFixed(2) ?? null,
      distanceKm,
      deliveryFee,
      cutleryIncludedCount: order.cutleryIncludedCount,
      cutleryExtraCount: order.cutleryExtraCount,
      cutleryUnitPrice: order.cutleryUnitPrice.toFixed(2),
      cutleryTotal: order.cutleryTotal.toFixed(2),
      totalAmount: order.totalAmount.toFixed(2),
      selectedItems,
      cutleryItems,
      region,
      event: {
        eventName: order.eventName,
        eventDate: order.eventDate,
        eventTimeStart: order.eventTimeStart
          ? storedEventTime(order.eventTimeStart)
          : null,
        address: order.address,
        region,
        distanceKm,
        deliveryFee,
      },
    };
  }
}
