import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  Prisma,
  PackageType,
  PackageMenuItemRole,
  SelectedItemRole,
} from '@prisma/client';
import { CartService } from '../src/modules/cart/cart.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PackagesService } from '../src/modules/packages/packages.service';
import { MenuService } from '../src/modules/menu/menu.service';
import { OperatingRegionsService } from '../src/modules/operating-regions/operating-regions.service';

test(
  'KG database flow: admin configuration, mixed checkout, snapshots and constraints',
  { skip: process.env.KG_DATABASE_TEST !== '1' },
  async () => {
    const db = new PrismaClient();
    const rollback = new Error('KG test rollback');
    const suffix = randomUUID();
    try {
      await assert.rejects(
        db.$transaction(
          async (tx) => {
            // Services share this transaction; every test record is rolled back.
            const scoped = new Proxy(tx, {
              get(target, key) {
                if (key === '$transaction')
                  return (callback: unknown) =>
                    typeof callback === 'function'
                      ? callback(scoped)
                      : Promise.all(callback as Promise<unknown>[]);
                return Reflect.get(target, key);
              },
            });
            const prisma = scoped as never;
            const pricing = new PricingService(prisma);
            const regions = new OperatingRegionsService(prisma);
            const orders = new OrdersService(prisma, pricing, regions);
            const carts = new CartService(prisma, pricing, orders, regions);
            const packages = new PackagesService(prisma, pricing);
            const menus = new MenuService(prisma);
            const user = await tx.user.create({
              data: {
                mobileNumber: `9${Date.now().toString().slice(-9)}`,
                name: 'KG test',
              },
            });
            const region = await tx.operatingRegion.create({
              data: {
                code: suffix,
                name: 'KG test kitchen',
                centerLatitude: 0,
                centerLongitude: 0,
                deliveryFeePerKm: 10,
              },
            });
            const address = await tx.userAddress.create({
              data: {
                userId: user.id,
                addressLine1: 'KG test address',
                city: 'Test',
                state: 'Test',
                pincode: '000000',
                latitude: 0,
                longitude: 0,
              },
            });
            const category = await tx.menuCategory.create({
              data: { name: `KG test ${suffix}` },
            });
            const item = await menus.createItem({
              name: 'KG test dish',
              categoryId: category.id,
              generalPrice: '90',
              boxPrice: '50',
              pricePerKg: '400.01',
            });
            const pkg = await packages.createPackage({
              name: `KG ${suffix}`,
              type: PackageType.ORDER_BY_KG,
            });
            const version = await packages.createVersion(pkg.id, {
              versionNo: 1,
              basePricePerPlate: '0',
              kgDefaultWeightGrams: 1500,
              kgWeightIncrementGrams: 500,
            });
            await assert.rejects(() =>
              packages.updateVersion(version.id, {
                publishedAt: new Date().toISOString(),
              }),
            );
            const initialConfiguration = await packages.getAdminConfiguration(
              version.id,
            );
            assert.equal(initialConfiguration.categoryRules.length, 0);
            assert.equal(initialConfiguration.kgDefaultWeightGrams, 1500);
            assert.equal(initialConfiguration.kgWeightIncrementGrams, 500);
            await packages.replaceComposition(version.id, {
              items: [
                {
                  menuItemId: item.id,
                  categoryId: category.id,
                  role: PackageMenuItemRole.CUSTOM_SELECTABLE,
                },
              ],
            });
            await packages.updateVersion(version.id, {
              publishedAt: new Date().toISOString(),
            });
            assert.equal(
              (await packages.getConfiguration(version.id)).categoryRules[0]
                .items[0].pricePerKg,
              '400.01',
            );
            const adminLocations = await packages.getRegionAvailability(
              version.id,
            );
            const testKitchen = adminLocations.find(
              (row) => row.region.id === region.id,
            )!;
            assert.equal(testKitchen.isAvailable, true);
            assert.equal(testKitchen.items[0].isAvailable, true);
            await packages.updateRegionAvailability(version.id, region.id, {
              isAvailable: false,
              items: testKitchen.items.map((row) => ({
                packageMenuItemId: row.packageMenuItemId,
                isAvailable: true,
              })),
            });
            await assert.rejects(
              () => packages.getConfiguration(version.id, region.id),
              /unavailable at this location/,
            );
            assert.equal(
              (await packages.listPackages(region.id)).some(
                (row) => row.id === pkg.id,
              ),
              false,
            );
            await assert.rejects(
              () =>
                carts.create(user.id, {
                  packageVersionId: version.id,
                  regionId: region.id,
                }),
              /unavailable at this location/,
            );
            await packages.updateRegionAvailability(version.id, region.id, {
              isAvailable: true,
              items: testKitchen.items.map((row) => ({
                packageMenuItemId: row.packageMenuItemId,
                isAvailable: false,
              })),
            });
            assert.equal(
              (await packages.getConfiguration(version.id, region.id))
                .categoryRules.length,
              0,
            );
            await packages.updateRegionAvailability(version.id, region.id, {
              isAvailable: true,
              items: testKitchen.items.map((row) => ({
                packageMenuItemId: row.packageMenuItemId,
                isAvailable: true,
              })),
            });
            const created = await carts.create(user.id, {
              packageVersionId: version.id,
              guestCount: 999,
              regionId: region.id,
            });
            assert.equal(created.guestCount, null);
            assert.equal(created.contactNumber, user.mobileNumber);
            const editedContactNumber = '9876543210';
            assert.equal(
              (
                await carts.update(user.id, created.id, {
                  packageVersionId: version.id,
                  contactNumber: editedContactNumber,
                })
              ).contactNumber,
              editedContactNumber,
            );
            await assert.rejects(() => carts.getById('other-user', created.id));
            await assert.rejects(() =>
              carts.updateQuantity(user.id, created.id, 12),
            );
            const selections = [
              {
                menuItemId: item.id,
                categoryId: category.id,
                role: SelectedItemRole.CUSTOM,
                quantity: 1,
                weightGrams: 1500,
              },
            ];
            await carts.replaceItems(user.id, created.id, {
              items: selections,
            });
            assert.equal(
              (await carts.getById(user.id, created.id)).items[0].weightGrams,
              1500,
            );
            const settings = await tx.platformSetting.findUnique({
              where: { key: 'event_service_start_time' },
            });
            const eventDate = new Date(Date.now() + 366 * 86400000)
              .toISOString()
              .slice(0, 10);
            const event = {
              packageVersionId: version.id,
              addressId: address.id,
              regionId: region.id,
              eventDate,
              eventTimeStart: settings?.value ?? '06:00',
            };
            await carts.update(user.id, created.id, event);
            const quoted = await carts.quote(user.id, created.id);
            assert.equal(quoted.subtotalAmount, '600.02');
            // Reprice before checkout, then ensure the completed order stays immutable.
            await menus.updateItem(item.id, { pricePerKg: '500.00' });
            const mealPackage = await packages.createPackage({
              name: `Box ${suffix}`,
              type: PackageType.MEAL_BOX,
            });
            const mealVersion = await packages.createVersion(mealPackage.id, {
              versionNo: 1,
              basePricePerPlate: '100',
              minGuestCount: 10,
            });
            await packages.replaceComposition(mealVersion.id, {
              items: [
                {
                  menuItemId: item.id,
                  categoryId: category.id,
                  role: PackageMenuItemRole.INCLUDED,
                },
              ],
            });
            await packages.updateVersion(mealVersion.id, {
              publishedAt: new Date().toISOString(),
            });
            const boxCart = await carts.create(user.id, {
              packageVersionId: mealVersion.id,
              guestCount: 10,
              regionId: region.id,
            });
            await carts.update(user.id, boxCart.id, {
              ...event,
              packageVersionId: mealVersion.id,
              guestCount: 10,
            });
            const mixedQuote = await carts.quoteAll(user.id);
            assert.equal(mixedQuote.subtotalAmount, '1750.00');
            const completed = await carts.checkoutAll(user.id);
            assert.equal(completed.length, 2);
            const kgOrder = completed.find(
              (order) => order.packageType === PackageType.ORDER_BY_KG,
            )!;
            assert.equal(kgOrder.guestCount, null);
            assert.equal(kgOrder.contactNumber, editedContactNumber);
            assert.equal(kgOrder.finalPerPlatePrice, null);
            assert.equal(kgOrder.totalAmount, '750.00');
            assert.equal(kgOrder.selectedItems?.[0].weightGrams, 1500);
            assert.equal(kgOrder.selectedItems?.[0].pricePerKg, '500.00');
            assert.equal(kgOrder.selectedItems?.[0].lineTotal, '750.00');
            assert.equal(
              (await tx.cart.findUniqueOrThrow({ where: { id: created.id } }))
                .status,
              'CHECKED_OUT',
            );
            await menus.updateItem(item.id, { pricePerKg: null });
            const historical = await orders.get(user.id, kgOrder.id);
            assert.equal(historical.totalAmount, '750.00');
            assert.equal(historical.selectedItems?.[0].itemPrice, '500.00');
            await assert.rejects(() =>
              pricing.quote(version.id, 1, selections),
            );
            assert.equal(
              (await packages.getConfiguration(version.id)).categoryRules
                .length,
              0,
            );
            await tx.$executeRawUnsafe('SAVEPOINT invalid_kg');
            await assert.rejects(() =>
              tx.orderSelectedItem.update({
                where: { id: kgOrder.selectedItems![0].id },
                data: { weightGrams: 250 },
              }),
            );
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_kg');
            assert.equal(
              (
                await tx.orderSelectedItem.findUniqueOrThrow({
                  where: { id: kgOrder.selectedItems![0].id },
                })
              ).weightGrams,
              1500,
            );
            await tx.$executeRawUnsafe('SAVEPOINT invalid_contact');
            await assert.rejects(() =>
              tx.order.update({
                where: { id: kgOrder.id },
                data: { contactNumber: '12345' },
              }),
            );
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_contact');
            assert.equal(
              (await tx.order.findUniqueOrThrow({ where: { id: kgOrder.id } }))
                .contactNumber,
              editedContactNumber,
            );
            throw rollback;
          },
          { timeout: 30000 },
        ),
        (error) => error === rollback,
      );
      assert.equal(
        await db.package.count({ where: { name: { contains: suffix } } }),
        0,
      );
    } finally {
      await db.$disconnect();
    }
  },
);
