import {
  AdminRole,
  PackageMenuItemRole,
  PackageType,
  OrderingOfferingCode,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();
const menuCsvPath = process.cwd().endsWith(join('apps', 'api'))
  ? join(process.cwd(), '..', '..', 'docs', 'TFF - Menu - Menu - Meal Box.csv')
  : join(process.cwd(), 'docs', 'TFF - Menu - Menu - Meal Box.csv');

type SeedMenuItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  isVeg: boolean;
  boxPrice: Prisma.Decimal;
  generalPrice: Prisma.Decimal;
};

async function main() {
  await seedSettings();
  await seedRegions();
  await seedAdmin();
  await seedOrderingOfferings();

  const menuRows = readMenuRows();
  const categoryByName = await seedCategories(menuRows);
  const menuItems = await seedMenuItems(menuRows, categoryByName);

  await seedFixedPackages(menuItems);
  await seedMealBoxes(menuItems);
  await seedCustomPackage(menuItems);
}

async function seedOrderingOfferings() {
  const offerings = [
    [
      OrderingOfferingCode.MEAL_BOX,
      'Meal Boxes',
      'One box per person with a complete, portioned meal.',
      '/order-mealbox.png',
      'Explore meal boxes',
      1,
    ],
    [
      OrderingOfferingCode.PACKAGES,
      'Packages',
      'Curated menus with clear inclusions and per-person pricing.',
      '/order-occasion.png',
      'View packages',
      2,
    ],
    [
      OrderingOfferingCode.CUSTOM_MENU,
      'Build Your Menu',
      'Choose dishes and build a menu around your event.',
      '/order-build.png',
      'Build your menu',
      3,
    ],
  ] as const;
  for (const [
    code,
    title,
    description,
    imageUrl,
    ctaLabel,
    displayOrder,
  ] of offerings) {
    await prisma.orderingOffering.upsert({
      where: { code },
      update: { title, description, displayOrder, isActive: true },
      create: { code, title, description, imageUrl, ctaLabel, displayOrder },
    });
  }
}

async function seedSettings() {
  const settings = [
    [
      'min_booking_lead_hours',
      '48',
      'Minimum hours required between booking and event time.',
    ],
    ['otp_expiry_seconds', '300', 'Customer OTP expiry duration.'],
    ['otp_max_attempts', '5', 'Maximum OTP verification attempts.'],
    ['razorpay_currency', 'INR', 'Default Razorpay currency.'],
    [
      'event_service_start_time',
      '06:00',
      'Earliest selectable event service time.',
    ],
    [
      'event_service_end_time',
      '23:30',
      'Latest selectable event service time.',
    ],
    [
      'event_time_interval_minutes',
      '30',
      'Interval between selectable event service times.',
    ],
    [
      'business_legal_name',
      '',
      'Legal business name shown on customer and order documents.',
    ],
    ['business_trade_name', '', 'Public trading name shown to customers.'],
    ['business_address', '', 'Public business or support address.'],
    ['business_gstin', '', 'GST registration number used on tax documents.'],
    ['business_state_code', '', 'GST state code used on tax documents.'],
    ['business_pan', '', 'Business PAN used on tax documents.'],
    ['business_support_email', '', 'Customer support email address.'],
    ['business_support_phone', '', 'Customer support phone number.'],
    ['business_logo_url', '', 'Business logo used on generated documents.'],
    ['invoice_prefix', 'INV', 'Prefix used for GST invoice numbers.'],
    ['receipt_prefix', 'RCT', 'Prefix used for payment receipt numbers.'],
    [
      'credit_note_prefix',
      'CRN',
      'Prefix used for refund credit-note numbers.',
    ],
    ['tax_cgst_rate', '0', 'CGST percentage used on GST invoices.'],
    ['tax_sgst_rate', '0', 'SGST percentage used on GST invoices.'],
    ['tax_igst_rate', '0', 'IGST percentage used on GST invoices.'],
    ['tax_sac_code', '', 'SAC code used on GST invoices.'],
    [
      'invoice_legal_footer',
      '',
      'Legal footer printed on invoices and receipts.',
    ],
  ] as const;

  for (const [key, value, description] of settings) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: { description },
      create: { key, value, description },
    });
  }
}

async function seedRegions() {
  const regions = [
    ['HYDERABAD', 'Hyderabad', '17.38500000', '78.48670000'],
    ['KARIMNAGAR', 'Karimnagar', '18.43860000', '79.12880000'],
    ['WARANGAL', 'Warangal', '17.96890000', '79.59410000'],
  ] as const;

  for (const [code, name, latitude, longitude] of regions) {
    await prisma.operatingRegion.upsert({
      where: { code },
      update: {
        name,
        centerLatitude: new Prisma.Decimal(latitude),
        centerLongitude: new Prisma.Decimal(longitude),
        serviceRadiusKm: new Prisma.Decimal('50.00'),
        deliveryFeePerKm: new Prisma.Decimal('10.00'),
        isActive: true,
      },
      create: {
        code,
        name,
        centerLatitude: new Prisma.Decimal(latitude),
        centerLongitude: new Prisma.Decimal(longitude),
        serviceRadiusKm: new Prisma.Decimal('50.00'),
        deliveryFeePerKm: new Prisma.Decimal('10.00'),
      },
    });
  }
}

async function seedAdmin() {
  const passwordHash = await bcrypt.hash('Admin@12345', 12);
  await prisma.adminUser.upsert({
    where: { email: 'admin@thefeastfactory.local' },
    update: { name: 'The Feast Factory Admin', role: AdminRole.ADMIN },
    create: {
      email: 'admin@thefeastfactory.local',
      name: 'The Feast Factory Admin',
      role: AdminRole.ADMIN,
      passwordHash,
    },
  });
}

function readMenuRows() {
  const csv = readFileSync(menuCsvPath, 'utf8');
  const [headerLine, ...lines] = parseCsv(csv);
  if (!headerLine?.length) return [];

  return lines
    .map((cells) => ({
      categoryName: cells[0]?.trim(),
      itemName: cells[1]?.trim(),
      baseOutletPrice: money(cells[2]),
      boxPrice: money(cells[5]) ?? money(cells[4]) ?? money(cells[6]),
      generalPrice: money(cells[6]) ?? money(cells[5]) ?? money(cells[4]),
    }))
    .filter((row) => row.categoryName && row.itemName)
    .filter((row) => row.boxPrice && row.generalPrice);
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function money(value?: string) {
  const normalized = value?.replace(/[^\d.]/g, '');
  if (!normalized) return null;
  return new Prisma.Decimal(Number(normalized).toFixed(2));
}

async function seedCategories(
  rows: ReturnType<typeof readMenuRows>,
): Promise<Map<string, { id: string; name: string }>> {
  const names = [
    ...new Set(rows.map((row) => normalizeCategory(row.categoryName))),
  ];
  const categoryByName = new Map<string, { id: string; name: string }>();

  for (const [index, name] of names.entries()) {
    const category = await prisma.menuCategory.upsert({
      where: { name },
      update: {
        displayOrder: index + 1,
        isActive: true,
      },
      create: {
        name,
        displayOrder: index + 1,
      },
    });
    categoryByName.set(name, category);
  }

  return categoryByName;
}

async function seedMenuItems(
  rows: ReturnType<typeof readMenuRows>,
  categoryByName: Map<string, { id: string; name: string }>,
) {
  const menuItems: SeedMenuItem[] = [];

  for (const row of rows) {
    const normalizedCategoryName = normalizeCategory(row.categoryName);
    const category = categoryByName.get(normalizedCategoryName);
    if (!category || !row.boxPrice || !row.generalPrice) continue;

    const item = await prisma.menuItem.upsert({
      where: {
        categoryId_name: {
          categoryId: category.id,
          name: row.itemName,
        },
      },
      update: {
        boxPrice: row.boxPrice,
        generalPrice: row.generalPrice,
        isVeg: isVeg(row.categoryName, row.itemName),
        isActive: true,
        deletedAt: null,
      },
      create: {
        categoryId: category.id,
        name: row.itemName,
        boxPrice: row.boxPrice,
        generalPrice: row.generalPrice,
        isVeg: isVeg(row.categoryName, row.itemName),
      },
    });

    menuItems.push({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      categoryName: normalizedCategoryName,
      isVeg: item.isVeg,
      boxPrice: item.boxPrice,
      generalPrice: item.generalPrice,
    });
  }

  return menuItems;
}

function normalizeCategory(name: string) {
  if (name === 'Veg Starters' || name === 'Non Veg Starters') return 'Starters';
  if (name === 'Veg Curry' || name === 'Non Veg Curry') return 'Curry';
  return name;
}

function isVeg(categoryName: string, itemName: string) {
  const text = `${categoryName} ${itemName}`.toLowerCase();
  return !/(non veg|chicken|mutton|fish|egg|prawn|kodi|mamsam|royyalu)/.test(
    text,
  );
}

async function seedFixedPackages(menuItems: SeedMenuItem[]) {
  await prisma.package.updateMany({
    where: {
      name: { in: ['Silver Package', 'Gold Package', 'Premium Package'] },
    },
    data: { isActive: false, deletedAt: new Date() },
  });

  const fixedPackages = [
    [
      'Pooja Package',
      '499.00',
      8,
      20,
      500,
      'A traditional vegetarian menu for poojas, housewarmings, and religious ceremonies.',
    ],
    [
      'Farm House Celebration',
      '599.00',
      12,
      20,
      200,
      'A generous celebration menu for birthdays, family gatherings, and weekend parties.',
    ],
    [
      'Corporate Gathering',
      '649.00',
      16,
      20,
      1000,
      'A premium, crowd-friendly menu for team lunches, client meets, and office events.',
    ],
  ] as const;

  for (const [
    index,
    [name, price, includedCount, minGuests, maxGuests, description],
  ] of fixedPackages.entries()) {
    const version = await upsertPackageVersion({
      name,
      description,
      type: PackageType.FIXED_PACKAGE,
      displayOrder: index + 1,
      price,
      minGuests,
      maxGuests,
      isFeatured: true,
      featuredOrder: index + 1,
    });

    const eligibleItems =
      name === 'Pooja Package'
        ? menuItems.filter((item) => item.isVeg)
        : menuItems;
    const included = selectBalancedItems(eligibleItems, includedCount);
    const includedIds = new Set(included.map((item) => item.id));
    const extras = eligibleItems.filter((item) => !includedIds.has(item.id));
    await prisma.packageMenuItem.deleteMany({
      where: { packageVersionId: version.id },
    });
    await upsertPackageItems(
      version.id,
      included,
      PackageMenuItemRole.INCLUDED,
      { isSwappable: false },
    );
    await upsertPackageItems(version.id, extras, PackageMenuItemRole.EXTRA, {
      isSwappable: false,
    });
  }
}

async function seedMealBoxes(menuItems: SeedMenuItem[]) {
  const mealBoxes = [
    ['3 Item Veg Meal Box', '99.00', 3, true],
    ['3 Item Non-Veg Meal Box', '145.00', 3, false],
    ['5 Item Veg Meal Box', '150.00', 5, true],
    ['5 Item Non-Veg Meal Box', '220.00', 5, false],
    ['8 Item Veg Meal Box', '220.00', 8, true],
    ['8 Item Non-Veg Meal Box', '290.00', 8, false],
  ] as const;

  for (const [index, [name, price, count, vegOnly]] of mealBoxes.entries()) {
    const version = await upsertPackageVersion({
      name,
      description:
        'Meal box with fixed included dishes. Swaps are allowed only within the same category and veg/non-veg type.',
      type: PackageType.MEAL_BOX,
      displayOrder: 20 + index,
      price,
      isFeatured: false,
    });
    const included = selectMealBoxItems(menuItems, count, vegOnly);
    await prisma.packageMenuItem.deleteMany({
      where: { packageVersionId: version.id },
    });
    for (const [itemIndex, item] of included.entries()) {
      await upsertPackageItems(
        version.id,
        [item],
        PackageMenuItemRole.INCLUDED,
        { isSwappable: itemIndex > 0 },
        itemIndex + 1,
      );
    }
  }
}

async function seedCustomPackage(menuItems: SeedMenuItem[]) {
  await prisma.package.updateMany({
    where: { name: 'Custom Package' },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  const version = await upsertPackageVersion({
    name: 'Custom Menu',
    description: 'Build your own package from any available dish.',
    type: PackageType.CUSTOM_PACKAGE,
    displayOrder: 100,
    price: '0.00',
    isFeatured: false,
  });
  await prisma.packageMenuItem.deleteMany({
    where: { packageVersionId: version.id },
  });
  await upsertPackageItems(
    version.id,
    menuItems,
    PackageMenuItemRole.CUSTOM_SELECTABLE,
    { isSwappable: false },
  );
}

async function upsertPackageVersion(input: {
  name: string;
  description: string;
  type: PackageType;
  displayOrder: number;
  price: string;
  minGuests?: number;
  maxGuests?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
}) {
  const presentation: Record<
    string,
    { imageUrl: string; badgeLabel?: string }
  > = {
    'Pooja Package': { imageUrl: '/pkg-puja.png', badgeLabel: 'Most popular' },
    'Farm House Celebration': { imageUrl: '/pkg-farmhouse.png' },
    'Corporate Gathering': { imageUrl: '/pkg-corporate.png' },
    '3 Item Veg Meal Box': { imageUrl: '/tray-3.png' },
    '3 Item Non-Veg Meal Box': { imageUrl: '/tray-3.png' },
    '5 Item Veg Meal Box': { imageUrl: '/tray-5.png' },
    '5 Item Non-Veg Meal Box': { imageUrl: '/tray-5.png' },
    '8 Item Veg Meal Box': { imageUrl: '/tray-8.png' },
    '8 Item Non-Veg Meal Box': { imageUrl: '/tray-8.png' },
    'Custom Menu': { imageUrl: '/order-build.png' },
  };
  const display = presentation[input.name];
  const pkg = await prisma.package.upsert({
    where: { name: input.name },
    update: {
      description: input.description,
      type: input.type,
      displayOrder: input.displayOrder,
      isActive: true,
      deletedAt: null,
      isFeatured: input.isFeatured ?? false,
      featuredOrder: input.featuredOrder ?? null,
    },
    create: {
      name: input.name,
      description: input.description,
      type: input.type,
      displayOrder: input.displayOrder,
      isFeatured: input.isFeatured ?? false,
      featuredOrder: input.featuredOrder ?? null,
      imageUrl: display?.imageUrl,
      badgeLabel: display?.badgeLabel,
    },
  });

  return prisma.packageVersion.upsert({
    where: { packageId_versionNo: { packageId: pkg.id, versionNo: 1 } },
    update: {
      basePricePerPlate: new Prisma.Decimal(input.price),
      minGuestCount: input.minGuests ?? 10,
      maxGuestCount: input.maxGuests ?? 500,
      isActive: true,
      publishedAt: new Date(),
    },
    create: {
      packageId: pkg.id,
      versionNo: 1,
      basePricePerPlate: new Prisma.Decimal(input.price),
      minGuestCount: input.minGuests ?? 10,
      maxGuestCount: input.maxGuests ?? 500,
      isActive: true,
      publishedAt: new Date(),
    },
  });
}

function selectMealBoxItems(
  menuItems: SeedMenuItem[],
  count: number,
  vegOnly: boolean,
) {
  const preferredCategories = vegOnly
    ? ['Starters', 'Indian Breads', 'Curry', 'Rice Items', 'Desserts']
    : [
        'Starters',
        'Indian Breads',
        'Curry',
        'Biryani',
        'Rice Items',
        'Desserts',
      ];
  const selected: SeedMenuItem[] = [];

  for (const categoryName of preferredCategories) {
    const item = menuItems.find(
      (candidate) =>
        candidate.categoryName === categoryName &&
        (!vegOnly || candidate.isVeg) &&
        (vegOnly ||
          !['Starters', 'Curry'].includes(categoryName) ||
          !candidate.isVeg) &&
        !selected.some((selectedItem) => selectedItem.id === candidate.id),
    );
    if (item) selected.push(item);
    if (selected.length === count) break;
  }

  if (selected.length < count) {
    selected.push(
      ...menuItems
        .filter((item) => (!vegOnly || item.isVeg) && !selected.includes(item))
        .slice(0, count - selected.length),
    );
  }

  return selected;
}

function selectBalancedItems(menuItems: SeedMenuItem[], count: number) {
  const selected: SeedMenuItem[] = [];
  const categoryNames = [
    ...new Set(menuItems.map((item) => item.categoryName)),
  ];
  for (const categoryName of categoryNames) {
    const item = menuItems.find(
      (candidate) =>
        candidate.categoryName === categoryName &&
        !selected.some((selectedItem) => selectedItem.id === candidate.id),
    );
    if (item) selected.push(item);
    if (selected.length === count) return selected;
  }
  selected.push(
    ...menuItems
      .filter(
        (item) => !selected.some((selectedItem) => selectedItem.id === item.id),
      )
      .slice(0, count - selected.length),
  );
  return selected;
}

async function upsertPackageItems(
  packageVersionId: string,
  menuItems: SeedMenuItem[],
  role: PackageMenuItemRole,
  options: { isSwappable: boolean },
  displayOrderOffset = 1,
) {
  for (const [index, item] of menuItems.entries()) {
    await prisma.packageMenuItem.upsert({
      where: {
        packageVersionId_menuItemId_role: {
          packageVersionId,
          menuItemId: item.id,
          role,
        },
      },
      update: {
        categoryId: item.categoryId,
        isAvailable: true,
        isSwappable: options.isSwappable,
        displayOrder: displayOrderOffset + index,
      },
      create: {
        packageVersionId,
        categoryId: item.categoryId,
        menuItemId: item.id,
        role,
        isAvailable: true,
        isSwappable: options.isSwappable,
        displayOrder: displayOrderOffset + index,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
