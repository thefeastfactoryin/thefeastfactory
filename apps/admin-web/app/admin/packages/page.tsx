'use client';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Switch from '@mui/material/Switch';
import type {
  MenuCategory,
  MenuItem,
  PackageConfiguration,
  OrderingOffering,
} from '@aranyam/shared-types';
import {
  CheckCircle2,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Field, Select, Textarea } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

type Version = {
  id: string;
  versionNo: number;
  basePricePerPlate: string;
  minGuestCount: number;
  maxGuestCount?: number | null;
  isActive: boolean;
  publishedAt?: string | null;
};

type AdminPackage = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  badgeLabel?: string | null;
  displayOrder: number;
  isCustom: boolean;
  type: 'MEAL_BOX' | 'FIXED_PACKAGE' | 'CUSTOM_PACKAGE';
  isActive: boolean;
  isFeatured: boolean;
  featuredOrder?: number | null;
  versions: Version[];
};

type MenuItemWithCategory = MenuItem & { category: MenuCategory };
type ConfigItem =
  PackageConfiguration['categoryRules'][number]['items'][number];
type CompositionRole = 'NONE' | 'INCLUDED' | 'EXTRA' | 'CUSTOM_SELECTABLE';

type PackageForm = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  badgeLabel: string;
  displayOrder: string;
  type: AdminPackage['type'];
  isActive: boolean;
  isFeatured: boolean;
  featuredOrder: string;
};

type VersionForm = {
  versionNo: string;
  basePricePerPlate: string;
  minGuestCount: string;
  maxGuestCount: string;
  isActive: boolean;
  published: boolean;
};

type PackageDialogMode = 'create-package' | 'edit-package' | 'add-version';

const emptyPackage: PackageForm = {
  name: '',
  description: '',
  imageUrl: '',
  badgeLabel: '',
  displayOrder: '0',
  type: 'FIXED_PACKAGE',
  isActive: true,
  isFeatured: false,
  featuredOrder: '',
};

const emptyVersion: VersionForm = {
  versionNo: '1',
  basePricePerPlate: '',
  minGuestCount: '10',
  maxGuestCount: '',
  isActive: true,
  published: false,
};

function formatMoney(value: string) {
  const normalized = value.trim().replace(/[₹,+\s]/g, '');
  if (!normalized) return '0.00';
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount.toFixed(2) : value.trim();
}

export default function AdminPackages() {
  const session = useAdminSessionStore((s) => s.session);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [offerings, setOfferings] = useState<OrderingOffering[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithCategory[]>([]);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceForm, setPriceForm] = useState<VersionForm>(emptyVersion);
  const [roleEdits, setRoleEdits] = useState<Record<string, CompositionRole>>(
    {},
  );
  const [swappableEdits, setSwappableEdits] = useState<Record<string, boolean>>(
    {},
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] =
    useState<PackageDialogMode>('create-package');
  const [dialogPackageId, setDialogPackageId] = useState('');
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackage);
  const [versionForm, setVersionForm] = useState<VersionForm>(emptyVersion);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId);
  const selectedVersion = selectedPackage?.versions.find(
    (version) => version.id === selectedVersionId,
  );

  const configItemsById = useMemo(() => {
    const entries =
      config?.categoryRules.flatMap((rule) =>
        rule.items.map((item) => [item.id, item] as const),
      ) ?? [];
    return new Map<string, ConfigItem>(entries);
  }, [config]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory =
        !categoryFilter || item.categoryId === categoryFilter;
      const matchesQuery =
        !needle ||
        `${item.name} ${item.description ?? ''} ${item.category.name}`
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [menuItems, query, categoryFilter]);

  async function loadBase(
    preferredPackageId?: string,
    preferredVersionId?: string,
  ) {
    if (!session) return;
    const [packageRows, categoryRows, itemRows, offeringRows] =
      await Promise.all([
        apiRequest<AdminPackage[]>('/admin/packages', {}, session.accessToken),
        apiRequest<MenuCategory[]>(
          '/admin/menu/categories',
          {},
          session.accessToken,
        ),
        apiRequest<MenuItemWithCategory[]>(
          '/admin/menu/items',
          {},
          session.accessToken,
        ),
        apiRequest<OrderingOffering[]>(
          '/admin/catalog/ordering-offerings',
          {},
          session.accessToken,
        ),
      ]);

    const packageId =
      preferredPackageId || selectedPackageId || packageRows[0]?.id || '';
    const packageRow = packageRows.find((row) => row.id === packageId);
    const versionId =
      preferredVersionId ||
      (selectedVersionId &&
      packageRow?.versions.some((row) => row.id === selectedVersionId)
        ? selectedVersionId
        : packageRow?.versions[0]?.id || '');

    setPackages(packageRows);
    setCategories(categoryRows);
    setMenuItems(itemRows);
    setOfferings(offeringRows);
    setSelectedPackageId(packageId);
    setSelectedVersionId(versionId);
  }

  async function loadConfig(versionId = selectedVersionId) {
    if (!session || !versionId) {
      setConfig(undefined);
      setRoleEdits({});
      setSwappableEdits({});
      return;
    }
    const nextConfig = await apiRequest<PackageConfiguration>(
      `/admin/package-versions/${versionId}/configuration`,
      {},
      session.accessToken,
    );
    setConfig(nextConfig);
    setRoleEdits(
      Object.fromEntries(
        nextConfig.categoryRules.flatMap((rule) =>
          rule.items.map((item) => [item.id, item.role ?? 'NONE']),
        ),
      ),
    );
    setSwappableEdits(
      Object.fromEntries(
        nextConfig.categoryRules.flatMap((rule) =>
          rule.items.map((item) => [item.id, item.isSwappable === true]),
        ),
      ),
    );
  }

  useEffect(() => {
    loadBase().catch((reason) => setError((reason as Error).message));
  }, [session]);

  useEffect(() => {
    loadConfig().catch((reason) => setError((reason as Error).message));
  }, [selectedVersionId, session]);

  useEffect(() => {
    if (!selectedVersion) {
      setPriceForm(emptyVersion);
      return;
    }
    setPriceForm({
      versionNo: String(selectedVersion.versionNo),
      basePricePerPlate: selectedVersion.basePricePerPlate,
      minGuestCount: String(selectedVersion.minGuestCount),
      maxGuestCount: selectedVersion.maxGuestCount
        ? String(selectedVersion.maxGuestCount)
        : '',
      isActive: selectedVersion.isActive,
      published: Boolean(selectedVersion.publishedAt),
    });
  }, [selectedVersionId, selectedVersion]);

  function nextVersionNo(pkg?: AdminPackage) {
    return Math.max(0, ...(pkg?.versions.map((v) => v.versionNo) ?? [])) + 1;
  }

  function openPackageDialog(mode: PackageDialogMode, pkg = selectedPackage) {
    setDialogMode(mode);
    setDialogPackageId(pkg?.id ?? '');
    setPackageForm(
      mode !== 'create-package' && pkg
        ? {
            id: pkg.id,
            name: pkg.name,
            description: pkg.description ?? '',
            imageUrl: pkg.imageUrl ?? '',
            badgeLabel: pkg.badgeLabel ?? '',
            displayOrder: String(pkg.displayOrder),
            type: pkg.type,
            isActive: pkg.isActive,
            isFeatured: pkg.isFeatured,
            featuredOrder:
              pkg.featuredOrder === null || pkg.featuredOrder === undefined
                ? ''
                : String(pkg.featuredOrder),
          }
        : emptyPackage,
    );
    setVersionForm(
      mode === 'edit-package'
        ? emptyVersion
        : { ...emptyVersion, versionNo: String(nextVersionNo(pkg)) },
    );
    setDialogOpen(true);
    setMessage('');
    setError('');
  }

  function versionPayload(form: VersionForm) {
    const basePricePerPlate = formatMoney(form.basePricePerPlate);
    if (Number.isNaN(Number(basePricePerPlate))) {
      throw new Error(
        'Package price must be a valid amount, like 499 or 499.00.',
      );
    }
    const payload: {
      versionNo: number;
      basePricePerPlate: string;
      minGuestCount: number;
      maxGuestCount?: number;
      isActive: boolean;
      publishedAt: string | null;
    } = {
      versionNo: Number(form.versionNo),
      basePricePerPlate,
      minGuestCount: Number(form.minGuestCount || 10),
      isActive: form.isActive,
      publishedAt: form.published ? new Date().toISOString() : null,
    };
    if (form.maxGuestCount) payload.maxGuestCount = Number(form.maxGuestCount);
    return payload;
  }

  function versionHasChanges(payload: ReturnType<typeof versionPayload>) {
    if (!selectedVersion) return false;
    return (
      payload.versionNo !== selectedVersion.versionNo ||
      payload.basePricePerPlate !== selectedVersion.basePricePerPlate ||
      payload.minGuestCount !== selectedVersion.minGuestCount ||
      (payload.maxGuestCount ?? null) !==
        (selectedVersion.maxGuestCount ?? null) ||
      payload.isActive !== selectedVersion.isActive ||
      Boolean(payload.publishedAt) !== Boolean(selectedVersion.publishedAt)
    );
  }

  async function savePackageDialog(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError('');
    try {
      const targetPackage =
        packages.find((pkg) => pkg.id === dialogPackageId) ?? selectedPackage;
      let savedPackage = targetPackage;
      if (dialogMode !== 'add-version') {
        const payload = {
          name: packageForm.name.trim(),
          description: packageForm.description.trim() || undefined,
          imageUrl: packageForm.imageUrl.trim(),
          badgeLabel: packageForm.badgeLabel.trim(),
          displayOrder: Number(packageForm.displayOrder || 0),
          type: packageForm.type,
          isActive: packageForm.isActive,
          isFeatured: packageForm.isFeatured,
          featuredOrder: packageForm.featuredOrder
            ? Number(packageForm.featuredOrder)
            : undefined,
        };
        savedPackage =
          dialogMode === 'edit-package' && packageForm.id
            ? await apiRequest<AdminPackage>(
                `/admin/packages/${packageForm.id}`,
                { method: 'PATCH', body: JSON.stringify(payload) },
                session.accessToken,
              )
            : await apiRequest<AdminPackage>(
                '/admin/packages',
                { method: 'POST', body: JSON.stringify(payload) },
                session.accessToken,
              );
      }

      if (!savedPackage)
        throw new Error('Select a package before adding a version.');

      let savedVersionId = selectedVersionId;
      if (dialogMode !== 'edit-package') {
        const savedVersion = await apiRequest<Version>(
          `/admin/packages/${savedPackage.id}/versions`,
          { method: 'POST', body: JSON.stringify(versionPayload(versionForm)) },
          session.accessToken,
        );
        savedVersionId = savedVersion.id;
      }

      setDialogOpen(false);
      setSelectedPackageId(savedPackage.id);
      setSelectedVersionId(savedVersionId);
      setMessage(
        dialogMode === 'add-version'
          ? `Version ${versionForm.versionNo} added.`
          : `${savedPackage.name} saved.`,
      );
      await loadBase(savedPackage.id, savedVersionId);
      await loadConfig(savedVersionId);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function savePackageChanges(event?: React.FormEvent) {
    event?.preventDefault();
    if (!session || !selectedVersionId || !selectedPackage) return;
    setSaving(true);
    setError('');
    try {
      const payload = versionPayload(priceForm);
      let savedChanges = 0;

      if (versionHasChanges(payload)) {
        await apiRequest(
          `/admin/package-versions/${selectedVersionId}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
          session.accessToken,
        );
        savedChanges += 1;
      }

      for (const item of menuItems) {
        const configured = configItemsById.get(item.id);
        const originalRole = (configured?.role ?? 'NONE') as CompositionRole;
        const nextRole = roleEdits[item.id] ?? originalRole;
        const originalSwappable = configured?.isSwappable === true;
        const nextSwappable =
          nextRole === 'INCLUDED' &&
          selectedPackage.type === 'MEAL_BOX' &&
          (swappableEdits[item.id] ?? originalSwappable);
        if (nextRole === originalRole && nextSwappable === originalSwappable)
          continue;

        if (originalRole !== 'NONE') {
          await apiRequest(
            `/admin/package-versions/${selectedVersionId}/menu-items/${item.id}/${originalRole}`,
            { method: 'DELETE' },
            session.accessToken,
          );
        }

        if (nextRole !== 'NONE')
          await apiRequest(
            `/admin/package-versions/${selectedVersionId}/menu-items`,
            {
              method: 'POST',
              body: JSON.stringify({
                categoryId: item.categoryId,
                menuItemId: item.id,
                role: nextRole,
                isAvailable: true,
                isSwappable: nextSwappable,
              }),
            },
            session.accessToken,
          );

        savedChanges += 1;
      }

      setMessage(
        savedChanges
          ? `Saved ${savedChanges} package change(s).`
          : 'No package changes to save.',
      );
      await loadBase(selectedPackageId, selectedVersionId);
      await loadConfig();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function updateOffering(
    offering: OrderingOffering,
    changes: Partial<OrderingOffering>,
  ) {
    if (!session) return;
    try {
      const updated = await apiRequest<OrderingOffering>(
        `/admin/catalog/ordering-offerings/${offering.code}`,
        { method: 'PATCH', body: JSON.stringify(changes) },
        session.accessToken,
      );
      setOfferings((rows) =>
        rows
          .map((row) => (row.code === updated.code ? updated : row))
          .sort((a, b) => a.displayOrder - b.displayOrder),
      );
      setMessage(`${updated.title} updated.`);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!session)
    return <main className="admin-page">Sign in to manage packages.</main>;

  return (
    <main className="admin-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Packages
          </p>
          <h1 className="admin-title mt-2">Package manager</h1>
          <p className="mt-2 text-muted-foreground">
            Select a package and version, update its price, and control which
            menu items appear with package-specific add-ons.
          </p>
        </div>
        <Button onClick={() => openPackageDialog('create-package')}>
          <Plus className="mr-2 h-4 w-4" />
          New package
        </Button>
      </div>

      {(message || error) && (
        <div className="mt-5 grid gap-3">
          {message && (
            <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
      )}

      <section className="mt-7">
        <div className="mb-3">
          <h2 className="text-xl font-semibold">Customer ordering options</h2>
          <p className="text-sm text-muted-foreground">
            Control which top-level ways to order appear on the home page.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {offerings.map((offering) => (
            <article
              key={offering.code}
              className="rounded-2xl border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong>{offering.title}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {offering.description}
                  </p>
                </div>
                <Switch
                  checked={offering.isActive}
                  onChange={(event) =>
                    updateOffering(offering, { isActive: event.target.checked })
                  }
                />
              </div>
              <Field label="Display order" className="mt-3">
                <Input
                  type="number"
                  min={0}
                  defaultValue={offering.displayOrder}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (value !== offering.displayOrder)
                      updateOffering(offering, { displayOrder: value });
                  }}
                />
              </Field>
              <Field label="Card image" className="mt-3">
                <Input
                  defaultValue={offering.imageUrl ?? ''}
                  placeholder="/order-mealbox.png"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== (offering.imageUrl ?? ''))
                      updateOffering(offering, { imageUrl: value });
                  }}
                />
              </Field>
              <Field label="CTA label" className="mt-3">
                <Input
                  defaultValue={offering.ctaLabel ?? ''}
                  placeholder="Explore"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== (offering.ctaLabel ?? ''))
                      updateOffering(offering, { ctaLabel: value });
                  }}
                />
              </Field>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Packages dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Select a package to expand pricing and menu controls below.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((pkg) => {
            const activeVersion = pkg.versions[0];
            const selected = pkg.id === selectedPackageId;
            return (
              <article
                key={pkg.id}
                className={`rounded-2xl border bg-white/90 p-4 shadow-[0_10px_35px_rgba(111,29,45,0.08)] transition ${
                  selected ? 'border-primary ring-2 ring-primary/15' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPackageId(pkg.id);
                    setSelectedVersionId(pkg.versions[0]?.id ?? '');
                  }}
                  className="block w-full text-left"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-lg font-semibold">
                        {pkg.name}
                      </span>
                      <span className="mt-1 block text-xs font-medium text-muted-foreground">
                        {pkg.isCustom ? 'Custom package' : 'Standard package'} ·{' '}
                        {pkg.isActive ? 'active' : 'hidden'}
                      </span>
                    </span>
                    {selected && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </span>
                  <span className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <span className="rounded-xl bg-muted/60 p-3">
                      <span className="block text-xs text-muted-foreground">
                        Versions
                      </span>
                      <span className="font-semibold">
                        {pkg.versions.length}
                      </span>
                    </span>
                    <span className="rounded-xl bg-muted/60 p-3">
                      <span className="block text-xs text-muted-foreground">
                        Latest price
                      </span>
                      <span className="font-semibold">
                        {activeVersion
                          ? `₹${activeVersion.basePricePerPlate}`
                          : '-'}
                      </span>
                    </span>
                  </span>
                </button>
                <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setSelectedVersionId(pkg.versions[0]?.id ?? '');
                      openPackageDialog('edit-package', pkg);
                    }}
                    aria-label={`Edit ${pkg.name}`}
                    title="Edit package"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setSelectedVersionId(pkg.versions[0]?.id ?? '');
                      openPackageDialog('add-version', pkg);
                    }}
                    aria-label={`Add version to ${pkg.name}`}
                    title="Add version"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            );
          })}
          {!packages.length && (
            <button
              type="button"
              onClick={() => openPackageDialog('create-package')}
              className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="mx-auto mb-2 h-6 w-6" />
              Add the first package
            </button>
          )}
        </div>
      </section>

      <section className="mt-6 space-y-6">
        <div className="admin-card">
          <div>
            <h2 className="text-2xl font-semibold">
              {selectedPackage?.name ?? 'No package selected'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedPackage?.description ||
                'Choose a package to edit package price and item add-ons.'}
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr]">
            <Field label="Version">
              <Select
                value={selectedVersionId}
                onChange={(event) => setSelectedVersionId(event.target.value)}
                disabled={!selectedPackage?.versions.length}
              >
                {selectedPackage?.versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    Version {version.versionNo} · ₹{version.basePricePerPlate}
                    {version.publishedAt ? '' : ' · draft'}
                  </option>
                ))}
              </Select>
            </Field>

            <form
              onSubmit={savePackageChanges}
              className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <Field label="Package price">
                <Input
                  value={priceForm.basePricePerPlate}
                  inputMode="decimal"
                  placeholder="499.00"
                  onBlur={(event) =>
                    setPriceForm({
                      ...priceForm,
                      basePricePerPlate: formatMoney(event.target.value),
                    })
                  }
                  onChange={(event) =>
                    setPriceForm({
                      ...priceForm,
                      basePricePerPlate: event.target.value,
                    })
                  }
                  required
                  disabled={!selectedVersionId}
                />
              </Field>
              <Field label="Min guests">
                <Input
                  type="number"
                  min={1}
                  value={priceForm.minGuestCount}
                  onChange={(event) =>
                    setPriceForm({
                      ...priceForm,
                      minGuestCount: event.target.value,
                    })
                  }
                  required
                  disabled={!selectedVersionId}
                />
              </Field>
              <Field label="Max guests" optional>
                <Input
                  type="number"
                  min={1}
                  value={priceForm.maxGuestCount}
                  onChange={(event) =>
                    setPriceForm({
                      ...priceForm,
                      maxGuestCount: event.target.value,
                    })
                  }
                  placeholder="No max"
                  disabled={!selectedVersionId}
                />
              </Field>
              <Button
                className="self-end"
                disabled={!selectedVersionId || saving}
              >
                <Save className="mr-2 h-4 w-4" />
                Save package changes
              </Button>
            </form>
          </div>
        </div>

        <div className="admin-card p-0">
          <div className="grid gap-3 border-b p-4 lg:grid-cols-[1fr_240px_auto]">
            <div className="flex items-center gap-3 rounded-xl border bg-white px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search menu items"
                className="border-0 shadow-none"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              onClick={() => savePackageChanges()}
              disabled={!selectedVersionId || saving}
            >
              <Save className="mr-2 h-4 w-4" />
              Save package changes
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="admin-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Menu item</th>
                  <th>Category</th>
                  <th>Menu price</th>
                  <th>Package role</th>
                  <th>Rule</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const configured = configItemsById.get(item.id);
                  const role = roleEdits[item.id] ?? configured?.role ?? 'NONE';
                  const allowedRoles: CompositionRole[] =
                    selectedPackage?.type === 'MEAL_BOX'
                      ? ['NONE', 'INCLUDED']
                      : selectedPackage?.type === 'FIXED_PACKAGE'
                        ? ['NONE', 'INCLUDED', 'EXTRA']
                        : ['NONE', 'CUSTOM_SELECTABLE'];
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImagePlus className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.isVeg ? 'Veg' : 'Non-veg'} ·{' '}
                              {item.isActive ? 'active' : 'hidden'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{item.category.name}</td>
                      <td>₹{item.generalPrice}</td>
                      <td>
                        <Select
                          value={role}
                          disabled={!selectedVersionId || saving}
                          onChange={(event) =>
                            setRoleEdits((current) => ({
                              ...current,
                              [item.id]: event.target.value as CompositionRole,
                            }))
                          }
                        >
                          {allowedRoles.map((option) => (
                            <option key={option} value={option}>
                              {option === 'NONE'
                                ? 'Not configured'
                                : option.replaceAll('_', ' ')}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        {selectedPackage?.type === 'MEAL_BOX' &&
                        role === 'INCLUDED' ? (
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={
                                swappableEdits[item.id] ??
                                configured?.isSwappable === true
                              }
                              onChange={(event) =>
                                setSwappableEdits((current) => ({
                                  ...current,
                                  [item.id]: event.target.checked,
                                }))
                              }
                            />
                            Swappable
                          </label>
                        ) : role === 'INCLUDED' ? (
                          'Locked inclusion'
                        ) : role === 'EXTRA' ? (
                          `+₹${item.generalPrice} per pax`
                        ) : role === 'CUSTOM_SELECTABLE' ? (
                          `₹${item.generalPrice} per pax`
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filteredItems.length && (
            <div className="p-8 text-center text-muted-foreground">
              No menu items match the current filters.
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle className="flex items-center justify-between">
          {dialogMode === 'add-version'
            ? 'Add version'
            : dialogMode === 'edit-package'
              ? 'Edit package'
              : 'Add package'}
          <button
            type="button"
            onClick={() => setDialogOpen(false)}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Close package dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogTitle>
        <DialogContent>
          <form onSubmit={savePackageDialog} className="grid gap-4 py-2">
            <Field label="Action">
              <Select
                value={dialogMode}
                onChange={(event) =>
                  openPackageDialog(event.target.value as PackageDialogMode)
                }
              >
                <option value="create-package">Add package</option>
                <option value="edit-package" disabled={!selectedPackage}>
                  Edit selected package
                </option>
                <option value="add-version" disabled={!selectedPackage}>
                  Add version to selected package
                </option>
              </Select>
            </Field>

            {dialogMode !== 'add-version' ? (
              <>
                <Field label="Package name">
                  <Input
                    value={packageForm.name}
                    onChange={(event) =>
                      setPackageForm({
                        ...packageForm,
                        name: event.target.value,
                      })
                    }
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label="Description" optional>
                  <Textarea
                    value={packageForm.description}
                    onChange={(event) =>
                      setPackageForm({
                        ...packageForm,
                        description: event.target.value,
                      })
                    }
                    maxLength={1000}
                  />
                </Field>
                <Field label="Card image" optional>
                  <Input
                    value={packageForm.imageUrl}
                    onChange={(event) =>
                      setPackageForm({
                        ...packageForm,
                        imageUrl: event.target.value,
                      })
                    }
                    placeholder="/pkg-community.png or uploaded URL"
                    maxLength={500}
                  />
                </Field>
                <Field label="Badge label" optional>
                  <Input
                    value={packageForm.badgeLabel}
                    onChange={(event) =>
                      setPackageForm({
                        ...packageForm,
                        badgeLabel: event.target.value,
                      })
                    }
                    placeholder="Most popular"
                    maxLength={100}
                  />
                </Field>
                <Field label="Display order">
                  <Input
                    type="number"
                    min={0}
                    value={packageForm.displayOrder}
                    onChange={(event) =>
                      setPackageForm({
                        ...packageForm,
                        displayOrder: event.target.value,
                      })
                    }
                    required
                  />
                </Field>
                <Field label="Product type">
                  <Select
                    value={packageForm.type}
                    onChange={(event) =>
                      setPackageForm({
                        ...packageForm,
                        type: event.target.value as AdminPackage['type'],
                      })
                    }
                  >
                    <option value="MEAL_BOX">Meal box</option>
                    <option value="FIXED_PACKAGE">Fixed package</option>
                    <option value="CUSTOM_PACKAGE">Custom package</option>
                  </Select>
                </Field>
                <label className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <span className="font-medium">
                    {packageForm.isActive ? 'Visible to customers' : 'Hidden'}
                  </span>
                  <Switch
                    checked={packageForm.isActive}
                    onChange={(event) =>
                      setPackageForm({
                        ...packageForm,
                        isActive: event.target.checked,
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <span className="font-medium">Feature on home page</span>
                  <Switch
                    checked={packageForm.isFeatured}
                    onChange={(event) =>
                      setPackageForm({
                        ...packageForm,
                        isFeatured: event.target.checked,
                      })
                    }
                  />
                </label>
                {packageForm.isFeatured && (
                  <Field label="Featured order">
                    <Input
                      type="number"
                      min={0}
                      value={packageForm.featuredOrder}
                      onChange={(event) =>
                        setPackageForm({
                          ...packageForm,
                          featuredOrder: event.target.value,
                        })
                      }
                      placeholder="1"
                    />
                  </Field>
                )}
              </>
            ) : (
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Package</p>
                <p className="font-semibold">{selectedPackage?.name}</p>
              </div>
            )}

            {dialogMode !== 'edit-package' && (
              <section className="grid gap-4 rounded-xl border p-4">
                <h3 className="font-semibold">
                  {dialogMode === 'create-package'
                    ? 'Initial version'
                    : 'Version details'}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Version number">
                    <Input
                      type="number"
                      min={1}
                      value={versionForm.versionNo}
                      onChange={(event) =>
                        setVersionForm({
                          ...versionForm,
                          versionNo: event.target.value,
                        })
                      }
                      required
                    />
                  </Field>
                  <Field label="Package price">
                    <Input
                      value={versionForm.basePricePerPlate}
                      inputMode="decimal"
                      placeholder="499.00"
                      onBlur={(event) =>
                        setVersionForm({
                          ...versionForm,
                          basePricePerPlate: formatMoney(event.target.value),
                        })
                      }
                      onChange={(event) =>
                        setVersionForm({
                          ...versionForm,
                          basePricePerPlate: event.target.value,
                        })
                      }
                      required
                    />
                  </Field>
                  <Field label="Minimum guests">
                    <Input
                      type="number"
                      min={1}
                      value={versionForm.minGuestCount}
                      onChange={(event) =>
                        setVersionForm({
                          ...versionForm,
                          minGuestCount: event.target.value,
                        })
                      }
                      required
                    />
                  </Field>
                  <Field label="Maximum guests" optional>
                    <Input
                      type="number"
                      min={1}
                      value={versionForm.maxGuestCount}
                      onChange={(event) =>
                        setVersionForm({
                          ...versionForm,
                          maxGuestCount: event.target.value,
                        })
                      }
                      placeholder="No max"
                    />
                  </Field>
                </div>
                <label className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <span className="font-medium">Published</span>
                  <Switch
                    checked={versionForm.published}
                    onChange={(event) =>
                      setVersionForm({
                        ...versionForm,
                        published: event.target.checked,
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <span className="font-medium">Active version</span>
                  <Switch
                    checked={versionForm.isActive}
                    onChange={(event) =>
                      setVersionForm({
                        ...versionForm,
                        isActive: event.target.checked,
                      })
                    }
                  />
                </label>
              </section>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {dialogMode === 'add-version' ? 'Save version' : 'Save package'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
