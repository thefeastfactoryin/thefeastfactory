import { PackageType, SelectedItemRole } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PackagesService } from '../src/modules/packages/packages.service';
import { PricingService } from '../src/modules/pricing/pricing.service';

async function main() {
  const prisma = new PrismaService();
  const packages = new PackagesService(prisma, new PricingService(prisma));
  await prisma.$connect();
  try {
    const rows = await prisma.package.findMany({
      where: { isActive: true },
      include: { versions: { where: { isActive: true }, take: 1 } },
    });
    const byType = (type: PackageType) => {
      const version = rows.find((row) => row.type === type)?.versions[0];
      if (!version) throw new Error(`Missing ${type} fixture`);
      return version;
    };

    const meal = byType(PackageType.MEAL_BOX);
    const mealConfig = await packages.getConfiguration(meal.id);
    const replacement = mealConfig.categoryRules.flatMap((rule) => rule.items)
      .find((item) => item.swapForMenuItemId);
    if (!replacement?.swapForMenuItemId) throw new Error('Meal-box swap fixture missing');
    const mealQuote = await packages.priceSelection(meal.id, {
      selectedItems: [{ categoryId: replacement.categoryId, menuItemId: replacement.id, replacedMenuItemId: replacement.swapForMenuItemId, role: SelectedItemRole.SWAP }],
    });
    if (Number(mealQuote.finalPerPlatePrice) < Number(mealQuote.basePricePerPlate))
      throw new Error('Meal-box swap reduced the price');

    const fixed = byType(PackageType.FIXED_PACKAGE);
    const fixedConfig = await packages.getConfiguration(fixed.id);
    const fixedItems = fixedConfig.categoryRules.flatMap((rule) => rule.items);
    const extra = fixedItems.find((item) => item.role === 'EXTRA');
    if (!extra) throw new Error('Fixed-package extra fixture missing');
    const fixedQuote = await packages.priceSelection(fixed.id, {
      selectedItems: [{ categoryId: extra.categoryId, menuItemId: extra.id, role: SelectedItemRole.EXTRA }],
    });
    if (!fixedQuote.items.some((item) => item.role === SelectedItemRole.INCLUDED))
      throw new Error('Fixed-package locked inclusions missing from quote');
    if (Number(fixedQuote.finalPerPlatePrice) <= Number(fixedQuote.basePricePerPlate))
      throw new Error('Fixed-package extra did not increase per-pax price');

    const custom = byType(PackageType.CUSTOM_PACKAGE);
    const customConfig = await packages.getConfiguration(custom.id);
    const customItems = customConfig.categoryRules.flatMap((rule) => rule.items).slice(0, 2);
    const customQuote = await packages.priceSelection(custom.id, {
      selectedItems: customItems.map((item) => ({ categoryId: item.categoryId, menuItemId: item.id, role: SelectedItemRole.CUSTOM })),
    });
    const expected = customItems.reduce((sum, item) => sum + Number(item.generalPrice), 0);
    if (Number(customQuote.finalPerPlatePrice) !== expected)
      throw new Error('Custom-package quote is not the selected item sum');
    console.log('Business rules OK: meal-box, fixed-package, and custom-package pricing.');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
