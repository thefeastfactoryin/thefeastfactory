'use client';

import type { CutleryItem } from '@aranyam/shared-types';
import { Check, Plus, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../../../components/admin-page-header';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

type EditableItem = CutleryItem & { isNew?: boolean };

const blankItem = (): EditableItem => ({
  id: `new-${Date.now()}`,
  name: '',
  extraLabel: '',
  description: '',
  unitLabel: 'piece',
  unitPrice: '0.00',
  includedQuantity: 0,
  imageUrl: '',
  displayOrder: 100,
  isActive: true,
  isNew: true,
});

export default function CutleryAdminPage() {
  const session = useAdminSessionStore((state) => state.session);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    apiRequest<CutleryItem[]>('/admin/cutlery', {}, session.accessToken)
      .then(setItems)
      .catch((reason) => setError((reason as Error).message));
  }, [session]);

  function update(id: string, changes: Partial<EditableItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
    setMessage('');
  }

  async function save(item: EditableItem) {
    if (!session || savingId) return;
    setSavingId(item.id);
    setError('');
    setMessage('');
    try {
      const saved = await apiRequest<CutleryItem>(
        item.isNew ? '/admin/cutlery' : `/admin/cutlery/${item.id}`,
        {
          method: item.isNew ? 'POST' : 'PATCH',
          body: JSON.stringify({
            name: item.name,
            extraLabel: item.extraLabel || undefined,
            description: item.description || undefined,
            unitLabel: item.unitLabel,
            unitPrice: Number(item.unitPrice || 0).toFixed(2),
            includedQuantity: Number(item.includedQuantity || 0),
            imageUrl: item.imageUrl || undefined,
            displayOrder: Number(item.displayOrder || 0),
            isActive: item.isActive,
          }),
        },
        session.accessToken,
      );
      setItems((current) =>
        current.map((row) => (row.id === item.id ? saved : row)),
      );
      setMessage(`${saved.name} saved.`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSavingId('');
    }
  }

  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Cutlery & essentials"
        description="Manage the add-on list and pricing shared by every package. Included quantities are free with each package."
        actions={
          <Button
            type="button"
            onClick={() => setItems((current) => [...current, blankItem()])}
          >
            <Plus className="mr-2 h-4 w-4" /> Add item
          </Button>
        }
      />

      {(message || error) && (
        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        >
          {error || message}
        </div>
      )}

      <section className="mt-5 space-y-4">
        {items.map((item) => (
          <article key={item.id} className="admin-card">
            <div className="grid gap-5 xl:grid-cols-[128px_minmax(0,1fr)_auto] xl:items-start">
              <div className="overflow-hidden rounded-2xl border bg-[#faf7f0]">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="aspect-square h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-square place-items-center px-4 text-center text-xs text-muted-foreground">
                    Add an image URL
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Customer name">
                  <Input
                    value={item.name}
                    onChange={(event) =>
                      update(item.id, { name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Extra-item label">
                  <Input
                    value={item.extraLabel ?? ''}
                    onChange={(event) =>
                      update(item.id, { extraLabel: event.target.value })
                    }
                  />
                </Field>
                <Field label="Price">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) =>
                      update(item.id, { unitPrice: event.target.value })
                    }
                  />
                </Field>
                <Field label="Unit">
                  <Input
                    value={item.unitLabel}
                    placeholder="piece, set, pack"
                    onChange={(event) =>
                      update(item.id, { unitLabel: event.target.value })
                    }
                  />
                </Field>
                <Field label="Free quantity per package">
                  <Input
                    type="number"
                    min="0"
                    value={item.includedQuantity}
                    onChange={(event) =>
                      update(item.id, {
                        includedQuantity: Number(event.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Display order">
                  <Input
                    type="number"
                    value={item.displayOrder}
                    onChange={(event) =>
                      update(item.id, {
                        displayOrder: Number(event.target.value),
                      })
                    }
                  />
                </Field>
                <label className="md:col-span-2 xl:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Image URL
                  </span>
                  <Input
                    value={item.imageUrl ?? ''}
                    onChange={(event) =>
                      update(item.id, { imageUrl: event.target.value })
                    }
                  />
                </label>
                <label className="md:col-span-2 xl:col-span-3">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Description
                  </span>
                  <Input
                    value={item.description ?? ''}
                    onChange={(event) =>
                      update(item.id, { description: event.target.value })
                    }
                  />
                </label>
                <label className="flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    onChange={(event) =>
                      update(item.id, { isActive: event.target.checked })
                    }
                  />{' '}
                  Active
                </label>
              </div>
              <Button
                type="button"
                disabled={savingId === item.id || !item.name.trim()}
                onClick={() => void save(item)}
                className="w-full xl:w-auto"
              >
                {savingId === item.id ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {savingId === item.id ? 'Saving' : 'Save'}
              </Button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
