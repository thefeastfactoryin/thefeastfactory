const MENU_CATEGORY_ORDER = [
  'starters',
  'breads',
  'curry',
  'rice items',
  'biryani',
  'desserts',
] as const;

export function menuCategoryRank(categoryName: string) {
  const normalized = categoryName.trim().toLowerCase();

  if (normalized.includes('starter')) return 0;
  if (normalized.includes('bread')) return 1;
  if (normalized.includes('curry')) return 2;
  if (normalized.includes('biryani')) return 4;
  if (normalized.includes('rice')) return 3;
  if (normalized.includes('dessert') || normalized.includes('sweet')) return 5;

  return MENU_CATEGORY_ORDER.length;
}

export function sortMenuCategories<T>(
  categories: readonly T[],
  getName: (category: T) => string,
) {
  return categories
    .map((category, index) => ({ category, index }))
    .sort(
      (left, right) =>
        menuCategoryRank(getName(left.category)) -
          menuCategoryRank(getName(right.category)) ||
        left.index - right.index,
    )
    .map(({ category }) => category);
}