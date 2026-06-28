import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CatalogService } from '../src/modules/catalog/catalog.service';

const migrationPath = new URL('../prisma/migrations/20260628180000_catalog_offerings_featured_categories/migration.sql', import.meta.url);

test('catalog migration creates offerings and remaps category references before deleting diet categories', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /CREATE TABLE "ordering_offerings"/);
  assert.match(sql, /ADD COLUMN "is_featured"/);
  const menuMove = sql.indexOf('UPDATE "menu_items"');
  const packageMove = sql.indexOf('UPDATE "package_menu_items"');
  const deleteSources = sql.indexOf('DELETE FROM "menu_categories"');
  assert.ok(menuMove >= 0 && packageMove > menuMove && deleteSources > packageMove);
  assert.match(sql, /UPDATE "cart_items"/);
  assert.match(sql, /UPDATE "order_selected_items"/);
});

test('public catalog lists only active offerings in display order', async () => {
  let received: unknown;
  const service = new CatalogService({ orderingOffering: { findMany: async (args: unknown) => { received = args; return []; } } } as never);
  await service.listOfferings(true);
  assert.deepEqual(received, { where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }] });
});
