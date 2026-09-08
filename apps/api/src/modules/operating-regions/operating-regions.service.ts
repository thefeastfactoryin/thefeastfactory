import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { JwtPayload } from '../../common/auth/jwt-payload';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOperatingRegionDto } from './dto/update-operating-region.dto';

type RegionRow = Prisma.OperatingRegionGetPayload<object>;

export type RegionAssignment = {
  region: RegionRow;
  distanceKm: Prisma.Decimal;
  billableDistanceKm: number;
  deliveryFee: Prisma.Decimal;
};

@Injectable()
export class OperatingRegionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(activeOnly = false) {
    return this.prisma.operatingRegion
      .findMany({
        where: activeOnly ? { isActive: true } : {},
        orderBy: [{ publicDisplayOrder: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.serialize(row)));
  }

  async listForAdmin(admin: JwtPayload, activeOnly = false) {
    const regionId = await this.resolveAdminScope(admin);
    const rows = await this.prisma.operatingRegion.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(regionId ? { id: regionId } : {}),
      },
      orderBy: [{ publicDisplayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.serialize(row));
  }

  async updateForAdmin(
    admin: JwtPayload,
    id: string,
    dto: UpdateOperatingRegionDto,
  ) {
    const regionId = await this.resolveAdminScope(admin, id);
    if (regionId && regionId !== id) {
      throw new ForbiddenException(
        'You can only update your assigned kitchen.',
      );
    }
    if (admin.role === AdminRole.OPERATIONS) {
      const disallowedFields = Object.keys(dto).filter(
        (field) => field !== 'isAcceptingOrders',
      );
      if (disallowedFields.length) {
        throw new ForbiddenException(
          'Kitchen operators can only change order availability.',
        );
      }
    }
    return this.update(id, dto);
  }

  async update(id: string, dto: UpdateOperatingRegionDto) {
    const current = await this.prisma.operatingRegion.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Operating region not found');

    const row = await this.prisma.operatingRegion.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kitchenAddress !== undefined
          ? { kitchenAddress: dto.kitchenAddress.trim() || null }
          : {}),
        ...(dto.fssaiLicenseNo !== undefined
          ? { fssaiLicenseNo: dto.fssaiLicenseNo.trim() || null }
          : {}),
        ...(dto.kitchenImageUrl !== undefined
          ? { kitchenImageUrl: dto.kitchenImageUrl.trim() || null }
          : {}),
        ...(dto.mapUrl !== undefined
          ? { mapUrl: dto.mapUrl.trim() || null }
          : {}),
        ...(dto.publicDisplayOrder !== undefined
          ? { publicDisplayOrder: dto.publicDisplayOrder }
          : {}),
        ...(dto.centerLatitude !== undefined
          ? { centerLatitude: new Prisma.Decimal(dto.centerLatitude) }
          : {}),
        ...(dto.centerLongitude !== undefined
          ? { centerLongitude: new Prisma.Decimal(dto.centerLongitude) }
          : {}),
        ...(dto.serviceRadiusKm !== undefined
          ? { serviceRadiusKm: new Prisma.Decimal(dto.serviceRadiusKm) }
          : {}),
        ...(dto.deliveryFeePerKm !== undefined
          ? { deliveryFeePerKm: new Prisma.Decimal(dto.deliveryFeePerKm) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isAcceptingOrders !== undefined
          ? { isAcceptingOrders: dto.isAcceptingOrders }
          : {}),
      },
    });
    return this.serialize(row);
  }

  async assign(
    latitude?: Prisma.Decimal | string | null,
    longitude?: Prisma.Decimal | string | null,
  ): Promise<RegionAssignment> {
    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {
      throw new BadRequestException(
        'Choose the exact event location on the map before placing an order.',
      );
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Event location coordinates are invalid.');
    }

    const regions = await this.prisma.operatingRegion.findMany({
      where: { isActive: true },
    });
    const matches = regions
      .map((region) => {
        const distance = haversineKm(
          lat,
          lng,
          Number(region.centerLatitude),
          Number(region.centerLongitude),
        );
        return { region, distance };
      })
      .filter(
        (entry) =>
          entry.region.isAcceptingOrders &&
          entry.distance <= Number(entry.region.serviceRadiusKm),
      )
      .sort((a, b) => a.distance - b.distance);

    const nearest = matches[0];
    if (!nearest) {
      const closedKitchen = regions.some((region) => {
        if (region.isAcceptingOrders) return false;
        return (
          haversineKm(
            lat,
            lng,
            Number(region.centerLatitude),
            Number(region.centerLongitude),
          ) <= Number(region.serviceRadiusKm)
        );
      });
      throw new BadRequestException(
        closedKitchen
          ? 'The kitchen serving this location is currently closed for new orders.'
          : 'This event location is outside our current kitchen service areas.',
      );
    }

    const distanceKm = new Prisma.Decimal(nearest.distance.toFixed(2));
    const billableDistanceKm = Math.ceil(nearest.distance);
    return {
      region: nearest.region,
      distanceKm,
      billableDistanceKm,
      deliveryFee: new Prisma.Decimal(billableDistanceKm).mul(
        nearest.region.deliveryFeePerKm,
      ),
    };
  }

  async assignToRegion(
    regionId: string,
    latitude?: Prisma.Decimal | string | null,
    longitude?: Prisma.Decimal | string | null,
  ): Promise<RegionAssignment> {
    const region = await this.prisma.operatingRegion.findFirst({
      where: { id: regionId, isActive: true, isAcceptingOrders: true },
    });
    if (!region) {
      throw new BadRequestException(
        'Choose an available kitchen location before placing an order.',
      );
    }
    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {
      throw new BadRequestException(
        'Choose the exact event location on the map before placing an order.',
      );
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Event location coordinates are invalid.');
    }

    const distance = haversineKm(
      lat,
      lng,
      Number(region.centerLatitude),
      Number(region.centerLongitude),
    );
    if (distance > Number(region.serviceRadiusKm)) {
      throw new BadRequestException(
        `This event location is outside the ${region.name} kitchen service area.`,
      );
    }

    const distanceKm = new Prisma.Decimal(distance.toFixed(2));
    const billableDistanceKm = Math.ceil(distance);
    return {
      region,
      distanceKm,
      billableDistanceKm,
      deliveryFee: new Prisma.Decimal(billableDistanceKm).mul(
        region.deliveryFeePerKm,
      ),
    };
  }

  async resolveLocation(latitude: string, longitude: string) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Location coordinates are invalid.');
    }

    const regions = await this.prisma.operatingRegion.findMany({
      where: { isActive: true },
      orderBy: [{ publicDisplayOrder: 'asc' }, { name: 'asc' }],
    });
    if (!regions.length) {
      return {
        serviceable: false,
        reason: 'OUTSIDE_SERVICE_AREA' as const,
        region: null,
        distanceKm: null,
      };
    }

    const distances = regions
      .map((region) => ({
        region,
        distance: haversineKm(
          lat,
          lng,
          Number(region.centerLatitude),
          Number(region.centerLongitude),
        ),
      }))
      .sort((first, second) => first.distance - second.distance);
    const assigned = distances.find(
      ({ region, distance }) =>
        region.isAcceptingOrders && distance <= Number(region.serviceRadiusKm),
    );
    if (assigned) {
      return {
        serviceable: true,
        reason: null,
        region: this.serialize(assigned.region),
        distanceKm: assigned.distance.toFixed(2),
      };
    }

    const closed = distances.find(
      ({ region, distance }) =>
        !region.isAcceptingOrders && distance <= Number(region.serviceRadiusKm),
    );
    const nearest = closed ?? distances[0];
    return {
      serviceable: false,
      reason: closed
        ? ('KITCHEN_CLOSED' as const)
        : ('OUTSIDE_SERVICE_AREA' as const),
      region: this.serialize(nearest.region),
      distanceKm: nearest.distance.toFixed(2),
    };
  }

  async resolveAdminScope(admin: JwtPayload, requestedRegionId?: string) {
    if (admin.role === AdminRole.OPERATIONS) {
      const dbAdmin = await this.prisma.adminUser.findUnique({
        where: { id: admin.sub },
        select: { regionId: true },
      });
      if (!dbAdmin?.regionId)
        throw new ForbiddenException(
          'Your operations account is not assigned to a region.',
        );
      return dbAdmin.regionId;
    }
    return requestedRegionId || undefined;
  }

  serialize(region: RegionRow) {
    return {
      ...region,
      centerLatitude: region.centerLatitude.toFixed(8),
      centerLongitude: region.centerLongitude.toFixed(8),
      serviceRadiusKm: region.serviceRadiusKm.toFixed(2),
      deliveryFeePerKm: region.deliveryFeePerKm.toFixed(2),
    };
  }
}

function haversineKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
