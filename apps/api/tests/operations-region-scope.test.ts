import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { OperationsService } from '../src/modules/operations/operations.service';

const operationsAdmin = {
  sub: 'admin-1',
  type: 'admin' as const,
  role: AdminRole.OPERATIONS,
  regionId: 'region-1',
};

function service() {
  let orderWhere: Record<string, unknown> | undefined;
  const operations = new OperationsService(
    {
      order: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          orderWhere = where;
          return null;
        },
      },
    } as never,
    {} as never,
    { resolveAdminScope: async () => 'region-1' } as never,
  );
  return { operations, where: () => orderWhere };
}

test('operations notes are scoped to the assigned region', async () => {
  const context = service();
  await assert.rejects(
    context.operations.notes(operationsAdmin, 'order-elsewhere'),
    NotFoundException,
  );
  assert.deepEqual(context.where(), {
    id: 'order-elsewhere',
    regionId: 'region-1',
  });
});

test('admin document lookup includes the operations region scope', async () => {
  const context = service();
  await assert.rejects(
    context.operations.documents(
      operationsAdmin.sub,
      'order-elsewhere',
      operationsAdmin,
    ),
    NotFoundException,
  );
  assert.deepEqual(context.where(), {
    id: 'order-elsewhere',
    regionId: 'region-1',
  });
});
