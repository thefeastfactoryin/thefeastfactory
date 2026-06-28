import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { AdminOrdersQueryDto } from '../src/modules/admin-orders/dto/admin-orders-query.dto';

function context(role?: AdminRole) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as never;
}

test('role guard permits only an explicitly allowed admin role', () => {
  const reflector = {
    getAllAndOverride: () => [AdminRole.ADMIN],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  assert.equal(guard.canActivate(context(AdminRole.ADMIN)), true);
  assert.equal(guard.canActivate(context(AdminRole.OPERATIONS)), false);
  assert.equal(guard.canActivate(context()), false);
});

test('role guard leaves endpoints without role metadata available to authenticated admins', () => {
  const reflector = {
    getAllAndOverride: () => undefined,
  } as unknown as Reflector;
  assert.equal(new RolesGuard(reflector).canActivate(context(AdminRole.OPERATIONS)), true);
});

test('admin order pagination transforms valid query strings and rejects unsafe limits', async () => {
  const valid = plainToInstance(AdminOrdersQueryDto, { page: '2', pageSize: '50' });
  assert.deepEqual(await validate(valid), []);
  assert.equal(valid.page, 2);
  assert.equal(valid.pageSize, 50);

  const invalid = plainToInstance(AdminOrdersQueryDto, { page: '0', pageSize: '101' });
  const errors = await validate(invalid);
  assert.equal(errors.length, 2);
});
