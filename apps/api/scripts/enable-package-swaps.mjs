import { PackageMenuItemRole, PackageType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const swapsPerPackage = 3;

async function main() {
  const packages = await prisma.package.findMany({
    where: {
      type: PackageType.FIXED_PACKAGE,
      isActive: true,
      deletedAt: null,
    },
    include: {
      versions: {
        where: { isActive: true, publishedAt: { not: null } },
        orderBy: { versionNo: 'desc' },
        take: 1,
        include: {
          packageMenuItems: {
            where: {
              role: PackageMenuItemRole.INCLUDED,
              isAvailable: true,
              menuItem: { isActive: true, deletedAt: null },
            },
            include: { menuItem: true, category: true },
            orderBy: [{ displayOrder: 'asc' }, { menuItem: { name: 'asc' } }],
          },
        },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });

  if (!packages.length) {
    console.log('No active fixed packages found.');
    return;
  }

  for (const pkg of packages) {
    const version = pkg.versions[0];
    if (!version) {
      console.log(`${pkg.name}: skipped (no published active version)`);
      continue;
    }

    const included = version.packageMenuItems;
    const categoryIds = [...new Set(included.map((row) => row.categoryId))];
    const alternatives = await prisma.menuItem.findMany({
      where: {
        categoryId: { in: categoryIds },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, categoryId: true, isVeg: true },
    });

    const eligible = included.filter((row) =>
      alternatives.some(
        (item) =>
          item.id !== row.menuItemId &&
          item.categoryId === row.categoryId &&
          item.isVeg === row.menuItem.isVeg,
      ),
    );
    const selected = eligible.slice(0, swapsPerPackage);

    if (!selected.length) {
      console.log(
        `${pkg.name}: skipped (no eligible same-category alternatives)`,
      );
      continue;
    }

    await prisma.packageMenuItem.updateMany({
      where: { id: { in: selected.map((row) => row.id) } },
      data: { isSwappable: true },
    });

    console.log(
      `${pkg.name}: enabled ${selected.length} swappable item(s): ${selected
        .map((row) => row.menuItem.name)
        .join(', ')}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
