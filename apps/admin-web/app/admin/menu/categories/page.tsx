'use client';

import type { MenuCategory } from '@aranyam/shared-types';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MenuTabs } from '../../../../components/menu-tabs';
import { Button } from '../../../../components/ui/button';
import { Field, Textarea } from '../../../../components/ui/form';
import { Input } from '../../../../components/ui/input';
import { apiRequest } from '../../../../lib/api';
import { useAdminSessionStore } from '../../../../store/session.store';

type CategoryDraft = {
  name: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
};

const emptyDraft: CategoryDraft = {
  name: '',
  description: '',
  displayOrder: '0',
  isActive: true,
};

export default function Categories() {
  const session = useAdminSessionStore((state) => state.session);
  const [rows, setRows] = useState<MenuCategory[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!session) return;
    setRows(
      await apiRequest<MenuCategory[]>(
        '/admin/menu/categories',
        {},
        session.accessToken,
      ),
    );
  }

  useEffect(() => {
    load().catch((reason) => setError((reason as Error).message));
  }, [session]);

  function beginCreate() {
    setDraft({ ...emptyDraft, displayOrder: String(rows.length + 1) });
    setEditingId('');
    setCreating(true);
    setError('');
  }

  function beginEdit(category: MenuCategory) {
    setDraft({
      name: category.name,
      description: category.description ?? '',
      displayOrder: String(category.displayOrder),
      isActive: category.isActive,
    });
    setCreating(false);
    setEditingId(category.id);
    setError('');
  }

  function cancel() {
    setCreating(false);
    setEditingId('');
    setDraft(emptyDraft);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        displayOrder: Number(draft.displayOrder || 0),
        isActive: draft.isActive,
      };
      await apiRequest(
        editingId ? `/admin/menu/categories/${editingId}` : '/admin/menu/categories',
        { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
        session.accessToken,
      );
      setMessage(`${payload.name} saved.`);
      cancel();
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(category: MenuCategory) {
    if (!session) return;
    setError('');
    try {
      await apiRequest(
        `/admin/menu/categories/${category.id}`,
        { method: 'PATCH', body: JSON.stringify({ isActive: !category.isActive }) },
        session.accessToken,
      );
      setMessage(`${category.name} ${category.isActive ? 'hidden' : 'activated'}.`);
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!session) return <main className="admin-page">Sign in to manage categories.</main>;

  return (
    <main className="admin-page">
      <MenuTabs />
      <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-eyebrow">Menu structure</p>
          <h1 className="admin-title mt-2">Categories</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Organize the menu, control customer visibility, and set the display order.
          </p>
        </div>
        <Button onClick={beginCreate} disabled={creating}>
          <Plus className="mr-2 h-4 w-4" /> Add category
        </Button>
      </div>

      {(message || error) && (
        <div className="mt-5" aria-live="polite">
          {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</p>}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        </div>
      )}

      {creating && (
        <form onSubmit={save} className="admin-card mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr_130px_auto] lg:items-end">
          <Field label="Category name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={100} /></Field>
          <Field label="Description" optional><Input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} /></Field>
          <Field label="Display order"><Input type="number" min={0} value={draft.displayOrder} onChange={(event) => setDraft({ ...draft, displayOrder: event.target.value })} /></Field>
          <div className="flex gap-2"><Button disabled={saving}><Check className="mr-2 h-4 w-4" />Save</Button><Button type="button" variant="outline" onClick={cancel} aria-label="Cancel"><X className="h-4 w-4" /></Button></div>
        </form>
      )}

      <section className="mt-6 grid gap-3">
        {rows.map((category) => {
          const editing = editingId === category.id;
          if (editing) {
            return (
              <form key={category.id} onSubmit={save} className="admin-card grid gap-4 lg:grid-cols-[1fr_1.4fr_130px_auto] lg:items-end">
                <Field label="Category name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></Field>
                <Field label="Description" optional><Textarea rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
                <Field label="Display order"><Input type="number" min={0} value={draft.displayOrder} onChange={(event) => setDraft({ ...draft, displayOrder: event.target.value })} /></Field>
                <div className="flex gap-2"><Button disabled={saving}><Check className="mr-2 h-4 w-4" />Save</Button><Button type="button" variant="outline" onClick={cancel}><X className="h-4 w-4" /></Button></div>
              </form>
            );
          }
          return (
            <article key={category.id} className="admin-card flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{category.name}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${category.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{category.isActive ? 'Visible' : 'Hidden'}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Order {category.displayOrder}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{category.description || 'No description yet.'}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => beginEdit(category)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                <Button type="button" variant="outline" onClick={() => void toggle(category)}>{category.isActive ? 'Hide' : 'Activate'}</Button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
