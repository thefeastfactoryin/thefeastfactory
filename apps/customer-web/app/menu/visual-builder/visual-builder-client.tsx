'use client';

import type { CartSummary, PackageConfiguration, PackageSummary } from '@aranyam/shared-types';
import {
  Check,
  ChevronRight,
  Filter,
  Leaf,
  Menu,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { OrderProgress } from '../../../components/order-progress';
import { SelectionContextPanel } from '../../../components/selection-context-panel';
import {
  VisualBuffetBuilder,
  type VisualBuffetItem,
} from '../../../components/visual-buffet-builder';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { StatePanel } from '../../../components/ui/state-panel';
import { apiRequest } from '../../../lib/api';
import { saveCartBeforeReview } from '../../../lib/cart-review';
import { cn } from '../../../lib/utils';
import { useOrderBuilderStore } from '../../../store/order-builder.store';
import { useSessionStore } from '../../../store/session.store';

type MenuSelectionItem =
  PackageConfiguration['categoryRules'][number]['items'][number];

type DishRow = {
  item: MenuSelectionItem;
  categoryId: string;
  categoryName: string;
  maxSelections: number;
};

export type VisualBuilderInitialPackage = {
  packageId: string;
  packageVersionId: string;
  packageName: string;
  packageType: PackageConfiguration['packageType'];
  isCustom: boolean;
  basePricePerPlate: string;
  minGuestCount: number;
  maxGuestCount?: number | null;
};

function DishSelector({
  config,
  selectedIds,
  activeCategory,
  search,
  diet,
  limitMessage,
  isCustom,
  isMealBox,
  onCategoryChange,
  onSearchChange,
  onDietChange,
  onSelect,
}: {
  config: PackageConfiguration;
  selectedIds: Set<string>;
  activeCategory: string;
  search: string;
  diet: 'all' | 'veg' | 'nonveg';
  limitMessage: string;
  isCustom: boolean;
  isMealBox: boolean;
  onCategoryChange: (categoryId: string) => void;
  onSearchChange: (search: string) => void;
  onDietChange: (diet: 'all' | 'veg' | 'nonveg') => void;
  onSelect: (row: DishRow) => void;
}) {
  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return config.categoryRules
      .flatMap((rule) =>
        rule.items.map((item) => ({
          item,
          categoryId: rule.category.id,
          categoryName: rule.category.name,
          maxSelections: rule.maxSelections,
        })),
      )
      .filter((row) => !activeCategory || row.categoryId === activeCategory)
      .filter((row) => diet === 'all' || row.item.isVeg === (diet === 'veg'))
      .filter(
        (row) =>
          !normalized ||
          row.item.name.toLowerCase().includes(normalized) ||
          row.categoryName.toLowerCase().includes(normalized) ||
          row.item.description?.toLowerCase().includes(normalized),
      );
  }, [activeCategory, config.categoryRules, diet, search]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-4 border-b bg-white/80 p-4 backdrop-blur">
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search dishes"
            className="pl-11"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'veg', 'nonveg'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={diet === value}
              onClick={() => onDietChange(value)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-2 text-xs font-bold',
                diet === value
                  ? 'border-primary bg-primary text-white'
                  : 'bg-white text-muted-foreground',
              )}
            >
              {value === 'all' ? 'All diets' : value === 'veg' ? 'Veg only' : 'Non-veg only'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Menu categories">
          <button
            type="button"
            onClick={() => onCategoryChange('')}
            className={cn(
              'shrink-0 rounded-full border px-3 py-2 text-xs font-bold',
              !activeCategory
                ? 'border-primary bg-primary text-white'
                : 'bg-white text-muted-foreground',
            )}
          >
            All
          </button>
          {config.categoryRules.map((rule) => (
            <button
              type="button"
              key={rule.id}
              onClick={() => onCategoryChange(rule.category.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-2 text-xs font-bold',
                activeCategory === rule.category.id
                  ? 'border-primary bg-primary text-white'
                  : 'bg-white text-muted-foreground',
              )}
            >
              {rule.category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {limitMessage && (
          <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {limitMessage}
          </p>
        )}
        <div className="space-y-3">
          {rows.map((row) => {
            const selected = selectedIds.has(
              row.item.swapForMenuItemId
                ? `${row.item.swapForMenuItemId}:${row.item.id}`
                : row.item.id,
            );
            const isLockedMealBoxItem =
              isMealBox && !row.item.swapForMenuItemId;
            return (
              <button
                type="button"
                key={`${row.categoryId}-${row.item.id}`}
                onClick={() => onSelect(row)}
                disabled={isLockedMealBoxItem}
                className={cn(
                  'grid w-full grid-cols-[84px_1fr_auto] gap-3 rounded-xl border bg-white/80 p-2 text-left transition',
                  selected && 'border-primary bg-primary/[0.045] ring-1 ring-primary',
                  isLockedMealBoxItem && 'cursor-default opacity-80',
                )}
                aria-label={`${selected ? 'Remove' : 'Add'} ${row.item.name}`}
              >
                <div className="h-20 overflow-hidden rounded-lg bg-muted">
                  {row.item.imageUrl ? (
                    <img
                      src={row.item.imageUrl}
                      alt={row.item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-primary">
                      <Leaf className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 py-1">
                  <p className="truncate font-semibold">{row.item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.categoryName}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold',
                        row.item.isVeg
                          ? 'bg-green-50 text-green-700'
                          : 'bg-orange-50 text-orange-700',
                      )}
                    >
                      <Leaf className="h-3 w-3" />
                      {row.item.isVeg ? 'Veg' : 'Non-veg'}
                    </span>
                    <span className="font-semibold text-primary">
                      {isCustom
                        ? `₹${row.item.itemPrice}`
                        : row.item.swapForMenuItemId
                          ? Number(row.item.adjustmentAmount) > 0
                            ? `Swap +₹${row.item.adjustmentAmount}`
                            : 'Free swap'
                        : Number(row.item.adjustmentAmount) > 0
                          ? `+₹${row.item.adjustmentAmount}`
                          : 'Included'}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    'mt-1 grid h-10 w-10 place-items-center rounded-full border text-primary transition',
                    selected
                      ? 'border-primary bg-primary text-white'
                      : 'bg-white hover:border-primary/50',
                    isLockedMealBoxItem &&
                      'opacity-60 hover:border-border',
                  )}
                >
                  {selected ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {!rows.length && (
          <div className="rounded-xl border bg-white/75 p-8 text-center">
            <Filter className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-3 font-semibold">No dishes match this view.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another category or search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function VisualBuilderClient({
  initialPackage,
  initialConfig,
}: {
  initialPackage?: VisualBuilderInitialPackage;
  initialConfig?: PackageConfiguration;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSessionStore((state) => state.session);
  const cartPackage = useOrderBuilderStore((state) => state.package);
  const event = useOrderBuilderStore((state) => state.event);
  const dbCartId = useOrderBuilderStore((state) => state.dbCartId);
  const guestCount = useOrderBuilderStore((state) => state.guestCount);
  const selectedItems = useOrderBuilderStore((state) => state.selectedItems);
  const setPackage = useOrderBuilderStore((state) => state.setPackage);
  const setDbCartId = useOrderBuilderStore((state) => state.setDbCartId);
  const toggleItem = useOrderBuilderStore((state) => state.toggleItem);
  const toggleSwap = useOrderBuilderStore((state) => state.toggleSwap);
  const removeItem = useOrderBuilderStore((state) => state.removeItem);
  const removeSwap = useOrderBuilderStore((state) => state.removeSwap);
  const clearSelections = useOrderBuilderStore(
    (state) => state.clearSelections,
  );
  const effectivePackage = cartPackage ?? initialPackage;
  const [config, setConfig] = useState<PackageConfiguration | undefined>(
    initialConfig,
  );
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [diet, setDiet] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [limitMessage, setLimitMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bootstrappingPackage, setBootstrappingPackage] = useState(false);
  const [initialPackageApplied, setInitialPackageApplied] = useState(false);

  useEffect(() => {
    if (!initialPackage || cartPackage || initialPackageApplied) return;
    setPackage(initialPackage);
    setInitialPackageApplied(true);
  }, [cartPackage, initialPackage, initialPackageApplied, setPackage]);

  useEffect(() => {
    const requestedVersionId = searchParams.get('packageVersionId');
    if (effectivePackage?.packageVersionId === requestedVersionId) return;
    if (!requestedVersionId) return;

    setBootstrappingPackage(true);
    apiRequest<PackageConfiguration>(
      `/package-versions/${requestedVersionId}/configuration`,
    )
      .then((configuration) => {
        setPackage({
          packageId: configuration.packageId,
          packageVersionId: configuration.id,
          packageName: configuration.packageName,
          packageType: configuration.packageType,
          isCustom: configuration.isCustom,
          basePricePerPlate: configuration.basePricePerPlate,
          minGuestCount: configuration.minGuestCount,
          maxGuestCount: configuration.maxGuestCount,
        });
        setError('');
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setBootstrappingPackage(false));
  }, [effectivePackage?.packageVersionId, searchParams, setPackage]);

  useEffect(() => {
    if (effectivePackage || searchParams.get('packageVersionId')) return;

    setBootstrappingPackage(true);
    apiRequest<PackageSummary[]>('/packages')
      .then((packages) => {
        const customPackage = packages.find(
          (item) => item.type === 'CUSTOM_PACKAGE' && item.activeVersion,
        );
        if (!customPackage?.activeVersion) return;
        setPackage({
          packageId: customPackage.id,
          packageVersionId: customPackage.activeVersion.id,
          packageName: customPackage.name,
          packageType: customPackage.type,
          isCustom: customPackage.isCustom,
          basePricePerPlate: customPackage.activeVersion.basePricePerPlate,
          minGuestCount: customPackage.activeVersion.minGuestCount,
          maxGuestCount: customPackage.activeVersion.maxGuestCount,
        });
        setError('');
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setBootstrappingPackage(false));
  }, [effectivePackage, searchParams, setPackage]);

  useEffect(() => {
    if (!effectivePackage?.packageVersionId) return;
    if (initialConfig?.id === effectivePackage.packageVersionId) {
      setConfig(initialConfig);
      return;
    }
    apiRequest<PackageConfiguration>(
      `/package-versions/${effectivePackage.packageVersionId}/configuration`,
    )
      .then(setConfig)
      .catch((reason) => setError(reason.message));
  }, [effectivePackage?.packageVersionId, initialConfig]);

  useEffect(() => {
    if (!session || !effectivePackage?.packageVersionId) return;
    apiRequest<CartSummary>(
      '/cart',
      {
        method: 'PUT',
        body: JSON.stringify({
          packageVersionId: effectivePackage.packageVersionId,
        }),
      },
      session.accessToken,
    )
      .then((cart) => {
        setDbCartId(cart.id);
        setSyncMessage('');
      })
      .catch((reason) => setSyncMessage(reason.message));
  }, [session, effectivePackage?.packageVersionId, setDbCartId]);

  useEffect(() => {
    if (!session || !dbCartId) return;
    const handle = window.setTimeout(() => {
      apiRequest(
        '/cart/items',
        {
          method: 'PUT',
          body: JSON.stringify({
            items: selectedItems.map((item) => ({
              categoryId: item.categoryId,
              menuItemId: item.menuItemId,
              replacedMenuItemId: item.replacedMenuItemId,
              role:
                item.role ??
                (item.replacedMenuItemId
                  ? 'SWAP'
                  : effectivePackage?.packageType === 'FIXED_PACKAGE'
                    ? 'EXTRA'
                    : 'CUSTOM'),
              quantity: 1,
            })),
          }),
        },
        session.accessToken,
      )
        .then(() => setSyncMessage(''))
        .catch((reason) => setSyncMessage(reason.message));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [session, dbCartId, selectedItems, effectivePackage?.packageType]);

  const selectedIds = useMemo(
    () =>
      new Set(
        selectedItems.map((item) =>
          item.replacedMenuItemId
            ? `${item.replacedMenuItemId}:${item.menuItemId}`
            : item.menuItemId,
        ),
      ),
    [selectedItems],
  );

  const visualItems = useMemo<VisualBuffetItem[]>(() => {
    if (!config) {
      return selectedItems.map((item) => ({ ...item }));
    }
    const itemLookup = new Map(
      config.categoryRules.flatMap((rule) =>
        rule.items.map((item) => [item.id, item] as const),
      ),
    );
    if (config.packageType === 'MEAL_BOX') {
      const included = config.categoryRules.flatMap((rule) =>
        rule.items
          .filter((item) => item.role === 'INCLUDED' && !item.swapForMenuItemId)
          .map((item) => {
            const swap = selectedItems.find(
              (selected) => selected.replacedMenuItemId === item.id,
            );
            const visual = swap ?? {
              categoryId: item.categoryId,
              categoryName: rule.category.name,
              menuItemId: item.id,
              menuItemName: item.name,
              itemPrice: item.itemPrice,
              adjustmentAmount: item.adjustmentAmount,
              isVeg: item.isVeg,
            };
            return {
              menuItemId: visual.menuItemId,
              menuItemName: visual.menuItemName,
              categoryName: rule.category.name,
              isVeg: visual.isVeg,
              imageUrl: itemLookup.get(visual.menuItemId)?.imageUrl,
              replacedMenuItemId: swap?.replacedMenuItemId,
              canRemove: Boolean(swap),
            };
          }),
      );
      return included;
    }

    return selectedItems.map((item) => ({
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      categoryName: item.categoryName,
      isVeg: item.isVeg,
      imageUrl: itemLookup.get(item.menuItemId)?.imageUrl,
      replacedMenuItemId: item.replacedMenuItemId,
      canRemove: true,
    }));
  }, [config, selectedItems]);

  const ruleProgress = useMemo(() => {
    if (!config) return [];
    return config.categoryRules.map((rule) => {
      const count = selectedItems.filter(
        (item) => item.categoryId === rule.category.id,
      ).length;
      return {
        rule,
        count,
        valid: count >= rule.minSelections && count <= rule.maxSelections,
      };
    });
  }, [config, selectedItems]);

  const isMealBox = config?.packageType === 'MEAL_BOX';
  const isCustom = Boolean(config?.isCustom || effectivePackage?.isCustom);
  const valid = isCustom
    ? selectedItems.length > 0
    : isMealBox
      ? true
      : ruleProgress.length > 0 && ruleProgress.every((item) => item.valid);
  const additions = selectedItems.reduce(
    (total, item) => total + Number(item.adjustmentAmount),
    0,
  );
  const perPlate = Number(effectivePackage?.basePricePerPlate ?? 0) + additions;
  const estimate = perPlate * guestCount;
  const displayedItemCount = isMealBox ? visualItems.length : selectedItems.length;

  function selectRow(row: DishRow) {
    if (isMealBox && row.item.swapForMenuItemId) {
      toggleSwap({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        menuItemId: row.item.id,
        menuItemName: row.item.name,
        replacedMenuItemId: row.item.swapForMenuItemId,
        replacedMenuItemName: row.item.swapForMenuItemName,
        role: 'SWAP',
        itemPrice: row.item.itemPrice,
        includedValue: row.item.includedValue,
        adjustmentAmount: row.item.adjustmentAmount,
        isVeg: row.item.isVeg,
      });
      setLimitMessage('');
      return;
    }
    if (isMealBox) {
      setLimitMessage('Choose a replacement option below a swappable item.');
      return;
    }
    const changed = toggleItem(
      {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        menuItemId: row.item.id,
        menuItemName: row.item.name,
        role: isCustom ? 'CUSTOM' : 'EXTRA',
        itemPrice: row.item.itemPrice,
        includedValue: row.item.includedValue,
        adjustmentAmount: row.item.adjustmentAmount,
        isVeg: row.item.isVeg,
      },
      row.maxSelections,
    );
    setLimitMessage(
      changed
        ? ''
        : `${row.categoryName} allows up to ${row.maxSelections} selections.`,
    );
  }

  async function review() {
    if (!session) {
      setLimitMessage('Sign in before checkout.');
      return;
    }
    try {
      const cart = await saveCartBeforeReview({ accessToken: session.accessToken, pkg: effectivePackage, event, guestCount });
      setDbCartId(cart.id);
      await apiRequest('/cart/items', {
        method: 'PUT',
        body: JSON.stringify({ items: selectedItems.map((item) => ({
          categoryId: item.categoryId,
          menuItemId: item.menuItemId,
          replacedMenuItemId: item.replacedMenuItemId,
          role: item.role ?? (item.replacedMenuItemId ? 'SWAP' : effectivePackage?.packageType === 'FIXED_PACKAGE' ? 'EXTRA' : 'CUSTOM'),
          quantity: 1,
        })) }),
      }, session.accessToken);
      await apiRequest('/cart/quote', { method: 'POST' }, session.accessToken);
      router.push('/checkout');
    } catch (reason) {
      setLimitMessage((reason as Error).message);
    }
  }

  if (bootstrappingPackage && !effectivePackage) {
    return (
      <main className="page-shell">
        <div className="h-96 animate-pulse rounded-xl bg-white/60" />
      </main>
    );
  }

  if (!effectivePackage) {
    return (
      <main className="page-shell">
        <StatePanel
          icon={ShoppingBag}
          eyebrow="Visual menu builder"
          title="Choose a package before building a visual menu"
          description="Packages define your course rules, included dishes, and premium additions so your estimate stays accurate."
          actionHref="/packages"
          actionLabel="Browse packages"
          secondaryHref="/menu"
          secondaryLabel="Preview dishes"
        />
      </main>
    );
  }

  if (error)
    return (
      <main className="page-shell">
        <StatePanel
          tone="danger"
          title="Visual builder could not load"
          description={error}
          actionHref="/menu/select"
          actionLabel="Use standard menu builder"
        />
      </main>
    );

  if (!config)
    return (
      <main className="page-shell">
        <div className="h-96 animate-pulse rounded-xl bg-white/60" />
      </main>
    );

  return (
    <main className="page-shell pb-56 md:pb-32">
      <OrderProgress current={event ? 2 : 1} />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Custom package builder</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold sm:text-5xl">
            Build your buffet table.
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Add dishes and watch the trays fill up as your custom menu comes
            together.
          </p>
        </div>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <Button variant="outline" onClick={clearSelections}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>
      <div className="mt-8"><SelectionContextPanel packageVersionId={config.id} minPax={config.minGuestCount} maxPax={config.maxGuestCount} /></div>

      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <VisualBuffetBuilder
            items={visualItems}
            onAdd={() => setMenuOpen(true)}
            onRemove={(menuItemId, replacedMenuItemId) => {
              if (replacedMenuItemId) removeSwap(replacedMenuItemId);
              else removeItem(menuItemId);
            }}
          />

          <section className="grid gap-3 rounded-xl border bg-white/85 p-4 shadow-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Items
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {displayedItemCount}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Per plate
              </p>
              <p className="mt-1 text-2xl font-semibold">
                ₹{perPlate.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Estimate
              </p>
              <p className="mt-1 text-2xl font-semibold text-primary">
                ₹{estimate.toFixed(0)}
              </p>
            </div>
          </section>
          {syncMessage && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {syncMessage}
            </p>
          )}

          <section
            id="mobile-dish-selector"
            className="surface-card h-[72vh] w-full max-w-full overflow-hidden xl:hidden"
          >
            <DishSelector
              config={config}
              selectedIds={selectedIds}
              activeCategory={activeCategory}
              search={search}
              diet={diet}
              limitMessage={limitMessage}
              isCustom={isCustom}
              isMealBox={isMealBox}
              onCategoryChange={setActiveCategory}
              onSearchChange={setSearch}
              onDietChange={setDiet}
              onSelect={selectRow}
            />
          </section>
        </div>

        <aside className="surface-card hidden h-[calc(100vh-8rem)] overflow-hidden xl:sticky xl:top-24 xl:block">
          <DishSelector
            config={config}
            selectedIds={selectedIds}
            activeCategory={activeCategory}
            search={search}
            diet={diet}
            limitMessage={limitMessage}
            isCustom={isCustom}
            isMealBox={isMealBox}
            onCategoryChange={setActiveCategory}
            onSearchChange={setSearch}
            onDietChange={setDiet}
            onSelect={selectRow}
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-44 z-40 px-4 md:bottom-16 xl:hidden">
        <Button
          asChild
          className="h-14 w-full shadow-[0_18px_35px_-18px_rgba(111,29,45,0.8)]"
        >
          <a href="#mobile-dish-selector">
            <Menu className="mr-2 h-5 w-5" />
            View menu
            <ChevronRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t bg-white p-4 shadow-[0_-18px_40px_-28px_rgba(111,29,45,0.85)] md:bottom-0 xl:hidden">
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Items
            </p>
            <p className="font-semibold">{displayedItemCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Estimate
            </p>
            <p className="font-semibold text-primary">₹{estimate.toFixed(0)}</p>
          </div>
          <Button disabled={!valid} onClick={review}>
            Review
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-sm xl:hidden">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close menu sheet"
            onClick={() => setMenuOpen(false)}
          />
          <section className="absolute inset-x-0 bottom-16 max-h-[calc(84vh-4rem)] overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl md:bottom-0 md:max-h-[84vh]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  Choose dishes
                </p>
                <p className="font-semibold">{config.packageName}</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border bg-white"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(84vh-8.5rem)] md:h-[calc(84vh-72px)]">
              <DishSelector
                config={config}
                selectedIds={selectedIds}
                activeCategory={activeCategory}
                search={search}
                diet={diet}
                limitMessage={limitMessage}
                isCustom={isCustom}
                isMealBox={isMealBox}
                onCategoryChange={setActiveCategory}
                onSearchChange={setSearch}
                onDietChange={setDiet}
                onSelect={selectRow}
              />
            </div>
          </section>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-40 hidden xl:block">
        <Button disabled={!valid} onClick={review}>
          Review and pay <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}
