import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const roots = ['apps/customer-web', 'apps/admin-web'];
const files = roots.flatMap((root) =>
  globSync(`${root}/**/*.{ts,tsx}`, { exclude: ['**/.next/**'] }),
);
const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
const forbiddenCalls = [
  '/category-rules',
  '/item-pricing',
  "'/orders/quote'",
  '"/orders/quote"',
];
const found = forbiddenCalls.filter((route) => source.includes(route));
if (found.length) {
  console.error(`Unsupported or duplicate frontend API calls: ${found.join(', ')}`);
  process.exit(1);
}

const requiredOwners = [
  ['packages', 'apps/api/src/modules/packages/packages.controller.ts'],
  ['cart', 'apps/api/src/modules/cart/cart.controller.ts'],
  ['orders', 'apps/api/src/modules/orders/orders.controller.ts'],
  ['payments', 'apps/api/src/modules/payments/payments.controller.ts'],
  ['admin packages', 'apps/api/src/modules/packages/admin-packages.controller.ts'],
  ['admin orders', 'apps/api/src/modules/admin-orders/admin-orders.controller.ts'],
];
for (const [owner, file] of requiredOwners) {
  if (!readFileSync(file, 'utf8').includes('@Controller')) {
    console.error(`Missing controller owner for ${owner}`);
    process.exit(1);
  }
}
console.log(`Contract inventory OK: ${requiredOwners.length} core owners, ${files.length} frontend files checked.`);
