import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { OperatingRegionsService } from '../src/modules/operating-regions/operating-regions.service';

function region(
  id: string,
  latitude: string,
  longitude: string,
  isAcceptingOrders: boolean,
) {
  return {
    id,
    code: id.toUpperCase(),
    name: id,
    kitchenAddress: null,
    fssaiLicenseNo: null,
    kitchenImageUrl: null,
    mapUrl: null,
    publicDisplayOrder: 0,
    centerLatitude: new Prisma.Decimal(latitude),
    centerLongitude: new Prisma.Decimal(longitude),
    serviceRadiusKm: new Prisma.Decimal('50'),
    deliveryFeePerKm: new Prisma.Decimal('10'),
    isActive: true,
    isAcceptingOrders,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

test('location resolution uses an available overlapping kitchen', async () => {
  const closed = region('nearest-closed', '17.3850', '78.4867', false);
  const open = region('nearby-open', '17.4000', '78.5000', true);
  const service = new OperatingRegionsService({
    operatingRegion: { findMany: async () => [closed, open] },
  } as never);

  const result = await service.resolveLocation('17.3860', '78.4870');

  assert.equal(result.serviceable, true);
  assert.equal(result.reason, null);
  assert.equal(result.region?.id, 'nearby-open');
});

test('location resolution reports a closed kitchen when no open kitchen covers it', async () => {
  const closed = region('warangal', '17.9689', '79.5941', false);
  const farOpen = region('hyderabad', '17.3850', '78.4867', true);
  const service = new OperatingRegionsService({
    operatingRegion: { findMany: async () => [closed, farOpen] },
  } as never);

  const result = await service.resolveLocation('17.9700', '79.5950');

  assert.equal(result.serviceable, false);
  assert.equal(result.reason, 'KITCHEN_CLOSED');
  assert.equal(result.region?.id, 'warangal');
});

test('order assignment reports when the covering kitchen is closed', async () => {
  const closed = region('warangal', '17.9689', '79.5941', false);
  const farOpen = region('hyderabad', '17.3850', '78.4867', true);
  const service = new OperatingRegionsService({
    operatingRegion: { findMany: async () => [closed, farOpen] },
  } as never);

  await assert.rejects(
    service.assign('17.9700', '79.5950'),
    /currently closed for new orders/,
  );
});

test('kitchen operators can only change availability for their assigned kitchen', async () => {
  const assigned = region('region-1', '17.3850', '78.4867', true);
  const prisma = {
    adminUser: {
      findUnique: async () => ({ regionId: assigned.id }),
    },
    operatingRegion: {
      findUnique: async () => assigned,
      update: async ({ data }: { data: { isAcceptingOrders?: boolean } }) => ({
        ...assigned,
        ...data,
      }),
    },
  };
  const service = new OperatingRegionsService(prisma as never);
  const operator = {
    sub: 'operator-1',
    type: 'admin' as const,
    role: AdminRole.OPERATIONS,
  };

  const updated = await service.updateForAdmin(operator, assigned.id, {
    isAcceptingOrders: false,
  });
  assert.equal(updated.isAcceptingOrders, false);

  await assert.rejects(
    service.updateForAdmin(operator, assigned.id, { name: 'Renamed' }),
    ForbiddenException,
  );
  await assert.rejects(
    service.updateForAdmin(operator, 'region-2', {
      isAcceptingOrders: false,
    }),
    ForbiddenException,
  );
});
