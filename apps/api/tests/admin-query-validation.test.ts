import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminRole } from '@prisma/client';
import { AdminRegionQueryDto } from '../src/common/dto/admin-region-query.dto';
import { OperationsCalendarQueryDto } from '../src/modules/operations/dto/operations-calendar-query.dto';
import { OperationsService } from '../src/modules/operations/operations.service';

test('admin region queries reject malformed UUIDs', async () => {
  const dto = plainToInstance(AdminRegionQueryDto, { regionId: 'not-a-uuid' });
  assert.equal((await validate(dto)).length, 1);
});

test('operations calendar queries reject malformed dates and region IDs', async () => {
  const dto = plainToInstance(OperationsCalendarQueryDto, {
    from: 'tomorrow',
    to: '2026-99-99',
    regionId: 'all-regions',
  });
  assert.equal((await validate(dto)).length, 3);
});

test('operations calendar rejects a reversed date range before querying', async () => {
  let queryCalls = 0;
  const service = new OperationsService(
    {
      order: {
        findMany: async () => {
          queryCalls += 1;
          return [];
        },
      },
    } as never,
    {} as never,
    { resolveAdminScope: async () => undefined } as never,
  );

  await assert.rejects(
    service.calendar(
      { sub: 'admin-1', type: 'admin', role: AdminRole.ADMIN },
      '2026-08-10',
      '2026-08-01',
    ),
    (error: unknown) =>
      error instanceof BadRequestException && /start date/.test(error.message),
  );
  assert.equal(queryCalls, 0);
});
