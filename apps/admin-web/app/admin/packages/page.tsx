'use client';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Switch from '@mui/material/Switch';
import type {
  MenuCategory,
  MenuItem,
  PackageConfiguration,
} from '@aranyam/shared-types';
import {
  BadgeIndianRupee,
  CheckCircle2,
  ClipboardList,
  ImagePlus,
  LayoutDashboard,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminPageHeader } from '../../../components/admin-page-header';
import { AdminSectionTabs } from '../../../components/admin-section-tabs';
import { Button } from '../../../components/ui/button';
import { MediaUploader } from '../../../components/media-uploader';
import { Field, Select, Textarea } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { resolveMediaUrl } from '../../../lib/media-url';
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
type CompositionFilter =
  | 'CONFIGURED'
  | 'INCLUDED'
  | 'SWAPPABLE'
  | 'EXTRA'
  | 'CUSTOM_SELECTABLE'
  | 'NONE';
type PackageEditorTab = 'overview' | 'pricing' | 'composition';

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

const packageTypeTabs: Array<{
  type: AdminPackage['type'];
  label: string;
  description: string;
}> = [
  {
    type: 'MEAL_BOX',
    label: 'Meal boxes',
    description: 'Pre-portioned boxes with included and swappable dishes.',
  },
  {
    type: 'FIXED_PACKAGE',
    label: 'Fixed packages',
    description: 'Curated menus with included dishes and optional extras.',
  },
  {
    type: 'CUSTOM_PACKAGE',
    label: 'Build your menu',
    description: 'Customer-selectable menus priced per chosen dish.',
  },
];

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
  const configRequestSequence = useRef(0);
  const session = useAdminSessionStore((s) => s.session);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithCategory[]>([]);
  const [config, setConfig] = useState<PackageConfiguration>();
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [activeType, setActiveType] =
    useState<AdminPackage['type']>('MEAL_BOX');
  const [compositionFilter, setCompositionFilter] =
    useState<CompositionFilter>('CONFIGURED');
  const [editorTab, setEditorTab] = useState<PackageEditorTab>('overview');
  const [packageQuery, setPackageQuery] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceForm, setPriceForm] = useState<VersionForm>(emptyVersion);
  const [priceFormVersionId, setPriceFormVersionId] = useState('');
  const [configVersionId, setConfigVersionId] = useState('');
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
  const activeTypeInfo = packageTypeTabs.find(
    (tab) => tab.type === activeType,
  )!;
  const newPackageLabel =
    activeType === 'MEAL_BOX'
      ? 'New meal box'
      : activeType === 'FIXED_PACKAGE'
        ? 'New fixed package'
        : 'New custom menu';
  const activeTypePackages = packages.filter((pkg) => pkg.type === activeType);
  const filteredPackages = activeTypePackages.filter((pkg) =>
    `${pkg.name} ${pkg.description ?? ''}`
      .toLowerCase()
      .includes(packageQuery.trim().toLowerCase()),
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
      const configured = configItemsById.get(item.id);
      const role = (roleEdits[item.id] ??
        configured?.role ??
        'NONE') as CompositionRole;
      const swappable =
        role === 'INCLUDED' &&
        (selectedPackage?.type === 'MEAL_BOX' ||
          selectedPackage?.type === 'FIXED_PACKAGE') &&
        (swappableEdits[item.id] ?? configured?.isSwappable === true);
      const matchesCategory =
        !categoryFilter || item.categoryId === categoryFilter;
      const matchesQuery =
        !needle ||
        `${item.name} ${item.description ?? ''} ${item.category.name}`
          .toLowerCase()
          .includes(needle);
      const matchesComposition =
        (compositionFilter === 'CONFIGURED' && role !== 'NONE') ||
        (compositionFilter === 'SWAPPABLE' && swappable) ||
        role === compositionFilter;
      return matchesCategory && matchesQuery && matchesComposition;
    });
  }, [
    categoryFilter,
    compositionFilter,
    configItemsById,
    menuItems,
    query,
    roleEdits,
    selectedPackage?.type,
    swappableEdits,
  ]);

  async function loadBase(
    preferredPackageId?: string,
    preferredVersionId?: string,
  ) {
    if (!session) return;
    const [packageRows, categoryRows, itemRows] = await Promise.all([
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
    ]);

    const packageId =
      preferredPackageId ||
      (packageRows.some(
        (row) => row.id === selectedPackageId && row.type === activeType,
      )
        ? selectedPackageId
        : '') ||
      packageRows.find((row) => row.type === activeType)?.id ||
      packageRows[0]?.id ||
      '';
    const packageRow = packageRows.find((row) => row.id === packageId);
    const versionId =
      preferredVersionId ||
      (selectedVersionId &&
      packageRow?.versions.some((row) => row.id === selectedVersionId)
        ? selectedVersionId
        : getPreferredVersionId(packageRow));

    setPackages(packageRows);
    setCategories(categoryRows);
    setMenuItems(itemRows);
    setSelectedPackageId(packageId);
    setSelectedVersionId(versionId);
  }

  async function loadConfig(versionId = selectedVersionId) {
    const requestSequence = ++configRequestSequence.current;
    if (!session || !versionId) {
      setConfig(undefined);
      setConfigVersionId('');
      setRoleEdits({});
      setSwappableEdits({});
      return;
    }
    setConfigVersionId('');
    const nextConfig = await apiRequest<PackageConfiguration>(
      `/admin/package-versions/${versionId}/configuration`,
      {},
      session.accessToken,
    );
    if (requestSequence !== configRequestSequence.current) return;
    setConfig(nextConfig);
    setConfigVersionId(versionId);
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
      setPriceFormVersionId('');
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
    setPriceFormVersionId(selectedVersion.id);
  }, [selectedVersionId, selectedVersion]);

  function nextVersionNo(pkg?: AdminPackage) {
    return Math.max(0, ...(pkg?.versions.map((v) => v.versionNo) ?? [])) + 1;
  }

  function getPreferredVersionId(pkg?: AdminPackage) {
    if (!pkg?.versions.length) return '';
    return (
      pkg.versions.find((version) => version.isActive)?.id ??
      [...pkg.versions].sort((a, b) => b.versionNo - a.versionNo)[0]?.id ??
      ''
    );
  }

  function formatGuestRange(version: Version) {
    return version.maxGuestCount
      ? `${version.minGuestCount}-${version.maxGuestCount} guests`
      : `${version.minGuestCount}+ guests`;
  }

  function selectPackageType(type: AdminPackage['type']) {
    if (
      type !== activeType &&
      pendingChangeCount > 0 &&
      !window.confirm('Discard unsaved package changes and switch type?')
    ) {
      return;
    }
    setActiveType(type);
    setPackageQuery('');
    setQuery('');
    setCategoryFilter('');
    setCompositionFilter('CONFIGURED');
    const first = packages.find((pkg) => pkg.type === type);
    setSelectedPackageId(first?.id ?? '');
    setSelectedVersionId(getPreferredVersionId(first));
  }

  function selectPackage(pkg: AdminPackage) {
    if (
      pkg.id !== selectedPackageId &&
      pendingChangeCount > 0 &&
      !window.confirm('Discard unsaved package changes and switch package?')
    ) {
      return;
    }
    setSelectedPackageId(pkg.id);
    setSelectedVersionId(getPreferredVersionId(pkg));
    setCompositionFilter('CONFIGURED');
  }

  function selectVersion(pkg: AdminPackage, versionId: string) {
    if (
      versionId !== selectedVersionId &&
      pendingChangeCount > 0 &&
      !window.confirm('Discard unsaved package changes and switch version?')
    ) {
      return;
    }
    setSelectedPackageId(pkg.id);
    setSelectedVersionId(versionId);
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
        : { ...emptyPackage, type: activeType },
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
      maxGuestCount: number | null;
      isActive: boolean;
      publishedAt: string | null;
    } = {
      versionNo: Number(form.versionNo),
      basePricePerPlate,
      minGuestCount: Number(form.minGuestCount || 10),
      maxGuestCount: form.maxGuestCount ? Number(form.maxGuestCount) : null,
      isActive: form.isActive,
      publishedAt: form.published ? new Date().toISOString() : null,
    };
    return payload;
  }

  function versionHasChanges(payload: ReturnType<typeof versionPayload>) {
    if (!selectedVersion) return false;
    return (
      payload.versionNo !== selectedVersion.versionNo ||
      payload.basePricePerPlate !==
        formatMoney(selectedVersion.basePricePerPlate) ||
      payload.minGuestCount !== selectedVersion.minGuestCount ||
      (payload.maxGuestCount ?? null) !==
        (selectedVersion.maxGuestCount ?? null) ||
      payload.isActive !== selectedVersion.isActive ||
      Boolean(payload.publishedAt) !== Boolean(selectedVersion.publishedAt)
    );
  }

  const pendingChanges = useMemo(() => {
    let pricing = false;
    let composition = 0;
    const canComparePrice =
      Boolean(selectedVersion) && priceFormVersionId === selectedVersionId;
    const canCompareMenu =
      Boolean(config) && configVersionId === selectedVersionId;

    if (canComparePrice) {
      try {
        pricing = versionHasChanges(versionPayload(priceForm));
      } catch {
        pricing = true;
      }
    }
    if (!canCompareMenu) return { pricing, composition };

    for (const item of menuItems) {
      const configured = configItemsById.get(item.id);
      const originalRole = (configured?.role ?? 'NONE') as CompositionRole;
      const nextRole = roleEdits[item.id] ?? originalRole;
      const originalSwappable = configured?.isSwappable === true;
      const nextSwappable =
        nextRole === 'INCLUDED' &&
        (selectedPackage?.type === 'MEAL_BOX' ||
          selectedPackage?.type === 'FIXED_PACKAGE') &&
        (swappableEdits[item.id] ?? originalSwappable);
      if (nextRole !== originalRole || nextSwappable !== originalSwappable) {
        composition += 1;
      }
    }
    return { pricing, composition };
  }, [
    configItemsById,
    config,
    configVersionId,
    menuItems,
    priceForm,
    priceFormVersionId,
    roleEdits,
    selectedPackage,
    selectedVersion,
    selectedVersionId,
    swappableEdits,
  ]);
  const pendingChangeCount =
    Number(pendingChanges.pricing) + pendingChanges.composition;
  const pendingSectionCount =
    Number(pendingChanges.pricing) + Number(pendingChanges.composition > 0);

  const compositionTabs = useMemo(() => {
    const counts: Record<CompositionFilter, number> = {
      CONFIGURED: 0,
      INCLUDED: 0,
      SWAPPABLE: 0,
      EXTRA: 0,
      CUSTOM_SELECTABLE: 0,
      NONE: 0,
    };

    for (const item of menuItems) {
      const configured = configItemsById.get(item.id);
      const role = (roleEdits[item.id] ??
        configured?.role ??
        'NONE') as CompositionRole;
      counts[role] += 1;
      if (role !== 'NONE') counts.CONFIGURED += 1;
      const swappable =
        role === 'INCLUDED' &&
        (selectedPackage?.type === 'MEAL_BOX' ||
          selectedPackage?.type === 'FIXED_PACKAGE') &&
        (swappableEdits[item.id] ?? configured?.isSwappable === true);
      if (swappable) counts.SWAPPABLE += 1;
    }

    const tabs: Array<{
      filter: CompositionFilter;
      label: string;
      helper: string;
    }> = [
      {
        filter: 'CONFIGURED',
        label: 'Configured',
        helper: 'Currently used',
      },
      {
        filter: 'INCLUDED',
        label: 'Included',
        helper: 'Part of package price',
      },
      ...(selectedPackage?.type === 'MEAL_BOX' ||
      selectedPackage?.type === 'FIXED_PACKAGE'
        ? [
            {
              filter: 'SWAPPABLE' as CompositionFilter,
              label: 'Swappable',
              helper: 'Swap within category',
            },
          ]
        : []),
      ...(selectedPackage?.type === 'FIXED_PACKAGE'
        ? [
            {
              filter: 'EXTRA' as CompositionFilter,
              label: 'Extras',
              helper: 'Paid add-ons',
            },
          ]
        : []),
      ...(selectedPackage?.type === 'CUSTOM_PACKAGE'
        ? [
            {
              filter: 'CUSTOM_SELECTABLE' as CompositionFilter,
              label: 'Selectable',
              helper: 'Customer can choose',
            },
          ]
        : []),
      {
        filter: 'NONE',
        label: 'Not included',
        helper: 'Available to add',
      },
    ];

    return tabs.map((tab) => ({ ...tab, count: counts[tab.filter] }));
  }, [
    configItemsById,
    menuItems,
    roleEdits,
    selectedPackage?.type,
    swappableEdits,
  ]);

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
            : null,
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
      setActiveType(savedPackage.type);
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

  async function savePricingChanges() {
    if (!session || !selectedVersionId) return;
    setSaving(true);
    setError('');
    try {
      const payload = versionPayload(priceForm);
      if (versionHasChanges(payload)) {
        await apiRequest(
          `/admin/package-versions/${selectedVersionId}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
          session.accessToken,
        );
      }
      setMessage('Version pricing and availability saved.');
      await loadBase(selectedPackageId, selectedVersionId);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveCompositionChanges() {
    if (!session || !selectedVersionId || !selectedPackage) return;
    setSaving(true);
    setError('');
    try {
      const items = menuItems.flatMap((item) => {
        const configured = configItemsById.get(item.id);
        const nextRole = (roleEdits[item.id] ??
          configured?.role ??
          'NONE') as CompositionRole;
        if (nextRole === 'NONE') return [];
        const nextSwappable =
          nextRole === 'INCLUDED' &&
          (selectedPackage.type === 'MEAL_BOX' ||
            selectedPackage.type === 'FIXED_PACKAGE') &&
          (swappableEdits[item.id] ?? configured?.isSwappable === true);
        return [
          {
            categoryId: item.categoryId,
            menuItemId: item.id,
            role: nextRole,
            isAvailable: true,
            isSwappable: nextSwappable,
          },
        ];
      });
      await apiRequest(
        `/admin/package-versions/${selectedVersionId}/composition`,
        { method: 'PUT', body: JSON.stringify({ items }) },
        session.accessToken,
      );
      setMessage(`Saved ${items.length} configured menu items.`);
      await loadConfig();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!session)
    return <main className="admin-page">Sign in to manage packages.</main>;

  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Package manager"
        description="Update package details, version pricing, availability, and menu composition."
        actions={
          <Button onClick={() => openPackageDialog('create-package')}>
            <Plus className="mr-2 h-4 w-4" />
            {newPackageLabel}
          </Button>
        }
        filters={
          <label className="w-full sm:max-w-sm">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Package type
            </span>
            <Select
              value={activeType}
              onChange={(event) =>
                selectPackageType(event.target.value as AdminPackage['type'])
              }
            >
              {packageTypeTabs.map((option) => (
                <option key={option.type} value={option.type}>
                  {option.label} (
                  {packages.filter((pkg) => pkg.type === option.type).length})
                </option>
              ))}
            </Select>
          </label>
        }
      />

      {(message || error) && (
        <div className="mt-5 grid gap-3">
          {message && (
            <p className="rounded-xl border-l-4 border-primary bg-primary/10 px-4 py-3 text-sm font-semibold text-primary shadow-sm">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 shadow-sm">
              {error}
            </p>
          )}
        </div>
      )}

      <section className="mt-5">
        <div className="mb-4 mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{activeTypeInfo.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTypeInfo.description}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose a name on the left. Edit price, versions, and package items
            on the right.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="admin-card p-0 xl:sticky xl:top-20 xl:self-start">
            <div className="border-b p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Packages</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeTypePackages.length} in {activeTypeInfo.label}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openPackageDialog('create-package')}
                  aria-label={newPackageLabel}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border bg-white px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={packageQuery}
                  onChange={(event) => setPackageQuery(event.target.value)}
                  placeholder="Search package names"
                  className="border-0 shadow-none"
                />
              </div>
            </div>

            <div className="max-h-[640px] overflow-y-auto p-2">
              {filteredPackages.map((pkg) => {
                const selected = pkg.id === selectedPackageId;
                const activeVersion = pkg.versions.find(
                  (version) => version.isActive,
                );
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => selectPackage(pkg)}
                    className={`mb-2 block w-full rounded-xl px-3 py-3 text-left transition ${
                      selected
                        ? 'bg-primary text-white shadow-[0_10px_25px_rgba(111,29,45,0.2)]'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {pkg.name}
                        </span>
                        <span
                          className={`mt-1 block text-xs ${
                            selected ? 'text-white/75' : 'text-muted-foreground'
                          }`}
                        >
                          {pkg.versions.length} version
                          {pkg.versions.length === 1 ? '' : 's'} ·{' '}
                          {activeVersion
                            ? `₹${activeVersion.basePricePerPlate}`
                            : 'No active price'}
                        </span>
                      </span>
                      {selected && <CheckCircle2 className="h-4 w-4" />}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          selected
                            ? 'bg-white/15 text-white'
                            : pkg.isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {pkg.isActive ? 'Visible' : 'Hidden'}
                      </span>
                      {pkg.isFeatured && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            selected
                              ? 'bg-white/15 text-white'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          Featured
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              {!filteredPackages.length && (
                <button
                  type="button"
                  onClick={() => openPackageDialog('create-package')}
                  className="w-full rounded-xl border border-dashed bg-white/70 p-6 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Plus className="mx-auto mb-2 h-5 w-5" />
                  Add the first package
                </button>
              )}
            </div>
          </aside>

          <div className="min-w-0">
            {selectedPackage ? (
              <div className="admin-card p-0">
                <div className="border-b bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Editing package
                      </p>
                      <h2 className="mt-1 truncate text-2xl font-semibold">
                        {selectedPackage.name}
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {selectedPackage.description ||
                          'Manage version price, guest limits, and menu composition from one workbench.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          openPackageDialog('edit-package', selectedPackage)
                        }
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit details
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          openPackageDialog('add-version', selectedPackage)
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add version
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {pendingSectionCount
                      ? `${pendingSectionCount} section${pendingSectionCount === 1 ? '' : 's'} contain unsaved changes`
                      : 'All package changes are saved'}
                  </p>
                </div>

                <AdminSectionTabs
                  value={editorTab}
                  onChange={setEditorTab}
                  label="Package editor"
                  className="px-2"
                  tabs={[
                    {
                      value: 'overview',
                      label: 'Overview',
                      icon: LayoutDashboard,
                    },
                    {
                      value: 'pricing',
                      label: 'Versions & pricing',
                      icon: BadgeIndianRupee,
                      count: pendingChanges.pricing ? 1 : undefined,
                    },
                    {
                      value: 'composition',
                      label: 'Menu composition',
                      icon: ClipboardList,
                      count: pendingChanges.composition || undefined,
                    },
                  ]}
                />

                {editorTab === 'overview' && (
                  <div
                    id="package-editor-overview-panel"
                    role="tabpanel"
                    aria-labelledby="package-editor-overview-tab"
                    className="grid gap-6 p-5 lg:grid-cols-[220px_1fr]"
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                      {selectedPackage.imageUrl ? (
                        <img
                          src={resolveMediaUrl(selectedPackage.imageUrl)}
                          alt={selectedPackage.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-muted-foreground">
                          <ImagePlus className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                        <div>
                          <h3 className="text-xl font-semibold">
                            Package details
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Customer-facing information and visibility settings.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            openPackageDialog('edit-package', selectedPackage)
                          }
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Update details
                        </Button>
                      </div>
                      <dl className="grid gap-x-8 gap-y-5 py-5 sm:grid-cols-2">
                        <SummaryField
                          label="Customer visibility"
                          value={
                            selectedPackage.isActive ? 'Visible' : 'Hidden'
                          }
                        />
                        <SummaryField
                          label="Featured on home page"
                          value={selectedPackage.isFeatured ? 'Yes' : 'No'}
                        />
                        <SummaryField
                          label="Package type"
                          value={activeTypeInfo.label}
                        />
                        <SummaryField
                          label="Display order"
                          value={String(selectedPackage.displayOrder)}
                        />
                        <SummaryField
                          label="Badge"
                          value={selectedPackage.badgeLabel || 'None'}
                        />
                        <SummaryField
                          label="Versions"
                          value={String(selectedPackage.versions.length)}
                        />
                      </dl>
                      {selectedPackage.description && (
                        <div className="border-t pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Description
                          </p>
                          <p className="mt-2 text-sm leading-6">
                            {selectedPackage.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {editorTab === 'pricing' && (
                  <div
                    id="package-editor-pricing-panel"
                    role="tabpanel"
                    aria-labelledby="package-editor-pricing-tab"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
                      <div>
                        <h3 className="text-xl font-semibold">
                          Versions and pricing
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Select a version, then update price, guest limits and
                          availability.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => savePricingChanges()}
                        disabled={
                          !selectedVersionId ||
                          !pendingChanges.pricing ||
                          saving
                        }
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? 'Saving...' : 'Save pricing'}
                      </Button>
                    </div>
                    <div className="grid gap-4 bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Version">
                        <Select
                          value={selectedVersionId}
                          onChange={(event) =>
                            selectVersion(selectedPackage, event.target.value)
                          }
                          disabled={!selectedPackage.versions.length}
                        >
                          {selectedPackage.versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              Version {version.versionNo} · ₹
                              {version.basePricePerPlate}
                              {' · '}
                              {formatGuestRange(version)}
                              {version.isActive ? ' · active' : ''}
                              {version.publishedAt ? '' : ' · draft'}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Package price">
                        <Input
                          value={priceForm.basePricePerPlate}
                          inputMode="decimal"
                          placeholder="499.00"
                          onBlur={(event) =>
                            setPriceForm({
                              ...priceForm,
                              basePricePerPlate: formatMoney(
                                event.target.value,
                              ),
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
                      <Field label="Publish status">
                        <Select
                          value={priceForm.published ? 'published' : 'draft'}
                          onChange={(event) =>
                            setPriceForm({
                              ...priceForm,
                              published: event.target.value === 'published',
                            })
                          }
                          disabled={!selectedVersionId}
                        >
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </Select>
                      </Field>
                      <Field label="Active version">
                        <Select
                          value={priceForm.isActive ? 'active' : 'inactive'}
                          onChange={(event) =>
                            setPriceForm({
                              ...priceForm,
                              isActive: event.target.value === 'active',
                            })
                          }
                          disabled={!selectedVersionId}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </Select>
                      </Field>
                    </div>
                    <div className="border-t p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold">Version history</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Published and draft versions remain available for
                            review.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            openPackageDialog('add-version', selectedPackage)
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add version
                        </Button>
                      </div>
                      <div className="mt-4 overflow-x-auto rounded-lg border">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Version</th>
                              <th>Price</th>
                              <th>Guest range</th>
                              <th>Publication</th>
                              <th>Availability</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPackage.versions.map((version) => (
                              <tr key={version.id}>
                                <td className="font-semibold">
                                  Version {version.versionNo}
                                </td>
                                <td>₹{version.basePricePerPlate}</td>
                                <td>{formatGuestRange(version)}</td>
                                <td>
                                  {version.publishedAt ? 'Published' : 'Draft'}
                                </td>
                                <td>
                                  {version.isActive ? 'Active' : 'Inactive'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {editorTab === 'composition' && (
                  <div
                    id="package-editor-composition-panel"
                    role="tabpanel"
                    aria-labelledby="package-editor-composition-tab"
                    className="p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold">
                          Menu composition
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Swaps are category-based: mark an included meal-box or
                          package item as swappable and customers can swap
                          within that item’s category.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCompositionFilter('NONE')}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add menu items
                        </Button>
                        <Button
                          type="button"
                          onClick={() => saveCompositionChanges()}
                          disabled={
                            !selectedVersionId ||
                            !pendingChanges.composition ||
                            saving
                          }
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {saving ? 'Saving...' : 'Save menu'}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 border-y bg-muted/20 py-4 md:grid-cols-2">
                      <label>
                        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                          Menu category
                        </span>
                        <Select
                          value={categoryFilter}
                          onChange={(event) =>
                            setCategoryFilter(event.target.value)
                          }
                        >
                          <option value="">All categories</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                          Search menu
                        </span>
                        <div className="flex min-h-11 items-center gap-3 rounded-lg border bg-white px-3">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search menu items"
                            className="border-0 shadow-none"
                          />
                        </div>
                      </label>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {compositionTabs.map((tab) => {
                        const active = tab.filter === compositionFilter;
                        return (
                          <button
                            key={tab.filter}
                            type="button"
                            onClick={() => setCompositionFilter(tab.filter)}
                            className={`min-w-fit rounded-lg border px-4 py-3 text-left text-sm transition ${
                              active
                                ? 'border-primary bg-primary text-white'
                                : 'bg-white hover:border-primary'
                            }`}
                          >
                            <span className="flex items-center gap-2 font-semibold">
                              {tab.label}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] ${
                                  active
                                    ? 'bg-white/15 text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {tab.count}
                              </span>
                            </span>
                            <span
                              className={`mt-1 block text-xs ${
                                active
                                  ? 'text-white/75'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {tab.helper}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 max-h-[560px] overflow-auto rounded-lg border bg-white">
                      <table className="admin-table min-w-[980px]">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr>
                            <th>Menu item</th>
                            <th>Category</th>
                            <th>Menu price</th>
                            <th>Package role</th>
                            <th>Category swap rule</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.map((item) => {
                            const configured = configItemsById.get(item.id);
                            const role =
                              roleEdits[item.id] ?? configured?.role ?? 'NONE';
                            const allowedRoles: CompositionRole[] =
                              selectedPackage.type === 'MEAL_BOX'
                                ? ['NONE', 'INCLUDED']
                                : selectedPackage.type === 'FIXED_PACKAGE'
                                  ? ['NONE', 'INCLUDED', 'EXTRA']
                                  : ['NONE', 'CUSTOM_SELECTABLE'];
                            return (
                              <tr key={item.id}>
                                <td>
                                  <div className="flex items-center gap-3">
                                    <div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                                      {item.imageUrl ? (
                                        <img
                                          src={resolveMediaUrl(item.imageUrl)}
                                          alt={item.name}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <ImagePlus className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        {item.name}
                                      </p>
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
                                        [item.id]: event.target
                                          .value as CompositionRole,
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
                                  {(selectedPackage.type === 'MEAL_BOX' ||
                                    selectedPackage.type === 'FIXED_PACKAGE') &&
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
                                      Swap within {item.category.name}
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
                      {!filteredItems.length && (
                        <div className="p-8 text-center text-muted-foreground">
                          No menu items match the current filters.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="admin-card grid min-h-[420px] place-items-center text-center">
                <div>
                  <Plus className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">No package selected</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose a package name from the left rail or create a new
                    one.
                  </p>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={() => openPackageDialog('create-package')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {newPackageLabel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="md"
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
                <MediaUploader
                  className="max-w-sm"
                  value={packageForm.imageUrl}
                  onChange={(imageUrl) =>
                    setPackageForm((current) => ({ ...current, imageUrl }))
                  }
                  accessToken={session.accessToken}
                  label="Package card image"
                  recommended="Recommended: 1600 × 1000 px. Preview uses the same crop as customer package cards."
                />
                <Field label="Image URL" optional>
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

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}
