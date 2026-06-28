'use client';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Switch from '@mui/material/Switch';
import type { MenuCategory, MenuItem } from '@aranyam/shared-types';
import {
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Field, Select, Textarea } from '../../../../components/ui/form';
import { Input } from '../../../../components/ui/input';
import { apiBaseUrl, apiRequest } from '../../../../lib/api';
import { useAdminSessionStore } from '../../../../store/session.store';

type MenuItemWithCategory = MenuItem & { category: MenuCategory };

type MenuForm = {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  boxPrice: string;
  generalPrice: string;
  isVeg: boolean;
  isActive: boolean;
  imageUrl: string;
};

const emptyForm: MenuForm = {
  categoryId: '',
  name: '',
  description: '',
  boxPrice: '',
  generalPrice: '',
  isVeg: true,
  isActive: true,
  imageUrl: '',
};

function formatMoney(value: string) {
  const normalized = value.trim().replace(/[₹,\s]/g, '');
  if (!normalized) return '';
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount.toFixed(2) : value.trim();
}

export default function MenuItems() {
  const session = useAdminSessionStore((state) => state.session);
  const [rows, setRows] = useState<MenuItemWithCategory[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<MenuForm>(emptyForm);

  async function load() {
    if (!session) return;
    const [items, categoryRows] = await Promise.all([
      apiRequest<MenuItemWithCategory[]>(
        '/admin/menu/items',
        {},
        session.accessToken,
      ),
      apiRequest<MenuCategory[]>(
        '/admin/menu/categories',
        {},
        session.accessToken,
      ),
    ]);
    setRows(items);
    setCategories(categoryRows);
  }

  useEffect(() => {
    load().catch((reason) => setError((reason as Error).message));
  }, [session]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !needle ||
        `${row.name} ${row.description ?? ''} ${row.category.name}`
          .toLowerCase()
          .includes(needle);
      const matchesCategory =
        !categoryFilter || row.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [rows, search, categoryFilter]);

  function openCreate() {
    const firstCategory = categories.find((category) => category.isActive);
    setForm({
      ...emptyForm,
      categoryId: firstCategory?.id ?? categories[0]?.id ?? '',
    });
    setEditorOpen(true);
    setMessage('');
    setError('');
  }

  function openEdit(item: MenuItemWithCategory) {
    setForm({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description ?? '',
      boxPrice: item.boxPrice,
      generalPrice: item.generalPrice,
      isVeg: item.isVeg,
      isActive: item.isActive,
      imageUrl: item.imageUrl ?? '',
    });
    setEditorOpen(true);
    setMessage('');
    setError('');
  }

  async function upload(file?: File) {
    if (!file || !session) return;
    setMessage(`Uploading ${file.name}...`);
    const data = new FormData();
    data.append('file', file);
    const result = await apiRequest<{ url: string }>(
      '/admin/uploads/menu-images',
      { method: 'POST', body: data },
      session.accessToken,
    );
    const imageUrl = result.url.startsWith('/')
      ? `${apiBaseUrl}${result.url}`
      : result.url;
    setForm((current) => ({ ...current, imageUrl }));
    setMessage('Image uploaded. Save the item to apply it.');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        categoryId: form.categoryId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        boxPrice: formatMoney(form.boxPrice),
        generalPrice: formatMoney(form.generalPrice),
        isVeg: form.isVeg,
        isActive: form.isActive,
        imageUrl: form.imageUrl.trim() || undefined,
      };
      if (
        Number.isNaN(Number(payload.boxPrice)) ||
        Number.isNaN(Number(payload.generalPrice))
      ) {
        throw new Error('Both menu prices must be valid amounts.');
      }
      await apiRequest(
        form.id ? `/admin/menu/items/${form.id}` : '/admin/menu/items',
        {
          method: form.id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
        session.accessToken,
      );
      setEditorOpen(false);
      setMessage(`${payload.name} saved.`);
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: MenuItemWithCategory) {
    if (
      !session ||
      !window.confirm(`Remove ${item.name} from the active menu?`)
    )
      return;
    setError('');
    await apiRequest(
      `/admin/menu/items/${item.id}`,
      { method: 'DELETE' },
      session.accessToken,
    );
    setMessage(`${item.name} removed from active menu.`);
    await load();
  }

  if (!session)
    return <main className="admin-page">Sign in to manage the menu.</main>;

  return (
    <main className="admin-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Menu
          </p>
          <h1 className="admin-title mt-2">Menu manager</h1>
          <p className="mt-2 text-muted-foreground">
            Maintain the actual item price, image, category, and availability.
            Package add-ons are managed from the package screen.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!categories.length}>
          <Plus className="mr-2 h-4 w-4" />
          Add menu item
        </Button>
      </div>

      <section className="admin-card mt-7 grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="flex items-center gap-3 rounded-xl border bg-white px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search item, category, description"
            className="border-0 shadow-none"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option value={category.id} key={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </section>

      {message && (
        <p className="mt-3 rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <section className="admin-card mt-5 overflow-x-auto p-0">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Menu price</th>
              <th>Food type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
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
                      {item.description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td>{item.category.name}</td>
                <td className="font-semibold">
                  ₹{item.boxPrice} / ₹{item.generalPrice}
                </td>
                <td>{item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}</td>
                <td>{item.isActive ? 'Active' : 'Hidden'}</td>
                <td>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => remove(item)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="p-8 text-center text-muted-foreground">
            No menu items match the current filters.
          </div>
        )}
      </section>

      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle className="flex items-center justify-between">
          {form.id ? 'Edit menu item' : 'Add menu item'}
          <button
            type="button"
            onClick={() => setEditorOpen(false)}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Close editor"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogTitle>
        <DialogContent>
          <form
            onSubmit={save}
            className="grid gap-6 py-2 lg:grid-cols-[260px_1fr]"
          >
            <div>
              <div className="aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.name || 'Menu item'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <ImagePlus className="h-10 w-10" />
                  </div>
                )}
              </div>
              <label className="mt-3 flex h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold hover:border-primary">
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload image
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    upload(event.target.files?.[0]).catch((reason) =>
                      setError((reason as Error).message),
                    )
                  }
                />
              </label>
              <Field label="Image URL" optional className="mt-4">
                <Input
                  value={form.imageUrl}
                  onChange={(event) =>
                    setForm({ ...form, imageUrl: event.target.value })
                  }
                  placeholder="https://..."
                />
              </Field>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Item name">
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    required
                    maxLength={150}
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={form.categoryId}
                    onChange={(event) =>
                      setForm({ ...form, categoryId: event.target.value })
                    }
                    required
                  >
                    {categories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                        {category.isActive ? '' : ' (inactive)'}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meal-box price">
                  <Input
                    value={form.boxPrice}
                    onBlur={(event) =>
                      setForm({
                        ...form,
                        boxPrice: formatMoney(event.target.value),
                      })
                    }
                    onChange={(event) =>
                      setForm({ ...form, boxPrice: event.target.value })
                    }
                    required
                    inputMode="decimal"
                    placeholder="120.00"
                  />
                </Field>
                <Field label="Package/custom price">
                  <Input
                    value={form.generalPrice}
                    onBlur={(event) =>
                      setForm({
                        ...form,
                        generalPrice: formatMoney(event.target.value),
                      })
                    }
                    onChange={(event) =>
                      setForm({ ...form, generalPrice: event.target.value })
                    }
                    required
                    inputMode="decimal"
                    placeholder="120.00"
                  />
                </Field>
                <Field label="Food type">
                  <RadioGroup
                    row
                    value={form.isVeg ? 'veg' : 'nonveg'}
                    onChange={(event) =>
                      setForm({ ...form, isVeg: event.target.value === 'veg' })
                    }
                  >
                    <FormControlLabel
                      value="veg"
                      control={<Radio />}
                      label="Veg"
                    />
                    <FormControlLabel
                      value="nonveg"
                      control={<Radio />}
                      label="Non-veg"
                    />
                  </RadioGroup>
                </Field>
              </div>
              <Field label="Description" optional>
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  maxLength={1000}
                />
              </Field>
              <label className="flex items-center justify-between rounded-xl border px-3 py-2">
                <span className="font-medium">
                  {form.isActive ? 'Visible to customers' : 'Hidden'}
                </span>
                <Switch
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.checked })
                  }
                />
              </label>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditorOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save item
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
