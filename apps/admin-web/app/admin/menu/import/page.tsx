'use client';

import type { MenuCategory } from '@aranyam/shared-types';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MenuTabs } from '../../../../components/menu-tabs';
import { Button } from '../../../../components/ui/button';
import { Select } from '../../../../components/ui/form';
import { apiRequest } from '../../../../lib/api';
import { useAdminSessionStore } from '../../../../store/session.store';

type ImportRow = {
  category: string;
  name: string;
  description?: string;
  boxPrice: string;
  generalPrice: string;
  foodType: 'VEG' | 'NON_VEG';
  isActive: boolean;
  imageUrl?: string;
};

type PreviewRow = ImportRow & { rowNumber: number; errors: string[] };
type ImportSummary = { total: number; created: number; updated: number; skipped: number };

const requiredHeaders = ['category', 'name', 'boxPrice', 'generalPrice', 'foodType'];
const template = `category,name,description,boxPrice,generalPrice,foodType,isActive,imageUrl\nStarters,Paneer Tikka,Chargrilled cottage cheese,120.00,150.00,VEG,true,https://example.com/paneer.jpg\n`;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function isMoney(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value);
}

export default function MenuImport() {
  const session = useAdminSessionStore((state) => state.session);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'SKIP' | 'UPDATE'>('UPDATE');
  const [createMissingCategories, setCreateMissingCategories] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ImportSummary>();
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!session) return;
    apiRequest<MenuCategory[]>('/admin/menu/categories', {}, session.accessToken)
      .then(setCategories)
      .catch((reason) => setError((reason as Error).message));
  }, [session]);

  const issueCount = useMemo(
    () => rows.reduce((total, row) => total + row.errors.length, 0),
    [rows],
  );

  function setMissingCategoryPolicy(enabled: boolean) {
    const categoryNames = new Set(
      categories.map((category) => category.name.toLowerCase()),
    );
    setCreateMissingCategories(enabled);
    setRows((current) =>
      current.map((row) => {
        const errors = row.errors.filter(
          (issue) => issue !== 'Category does not exist',
        );
        if (
          !enabled &&
          row.category &&
          !categoryNames.has(row.category.toLowerCase())
        ) {
          errors.push('Category does not exist');
        }
        return { ...row, errors };
      }),
    );
  }

  async function readFile(file?: File) {
    if (!file) return;
    setError('');
    setSummary(undefined);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a CSV file. Download the template for the expected columns.');
      return;
    }
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setError('The file needs a header row and at least one menu item.');
      return;
    }
    if (parsed.length > 1001) {
      setError('Import up to 1,000 menu items at a time.');
      return;
    }
    const headers = parsed[0].map((header) => header.replace(/^\uFEFF/, '').trim());
    const missing = requiredHeaders.filter((header) => !headers.includes(header));
    if (missing.length) {
      setError(`Missing required columns: ${missing.join(', ')}.`);
      return;
    }
    const categoryNames = new Set(categories.map((category) => category.name.toLowerCase()));
    const nextRows = parsed.slice(1).map((cells, index) => {
      const record = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']));
      const foodType = record.foodType.toUpperCase();
      const errors: string[] = [];
      if (!record.category) errors.push('Category is required');
      else if (!createMissingCategories && !categoryNames.has(record.category.toLowerCase())) errors.push('Category does not exist');
      if (!record.name) errors.push('Name is required');
      if (!isMoney(record.boxPrice)) errors.push('Invalid meal-box price');
      if (!isMoney(record.generalPrice)) errors.push('Invalid package price');
      if (!['VEG', 'NON_VEG'].includes(foodType)) errors.push('Food type must be VEG or NON_VEG');
      if (record.imageUrl) {
        try { new URL(record.imageUrl); } catch { errors.push('Image URL is invalid'); }
      }
      return {
        rowNumber: index + 2,
        category: record.category,
        name: record.name,
        description: record.description || undefined,
        boxPrice: record.boxPrice,
        generalPrice: record.generalPrice,
        foodType: (foodType === 'NON_VEG' ? 'NON_VEG' : 'VEG') as ImportRow['foodType'],
        isActive: !['false', '0', 'no'].includes(record.isActive.toLowerCase()),
        imageUrl: record.imageUrl || undefined,
        errors,
      };
    });
    setFileName(file.name);
    setRows(nextRows);
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'the-feast-factory-menu-import.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function commitImport() {
    if (!session || !rows.length || issueCount) return;
    setImporting(true);
    setError('');
    try {
      const result = await apiRequest<ImportSummary>(
        '/admin/menu/items/import',
        {
          method: 'POST',
          body: JSON.stringify({
            duplicateStrategy,
            createMissingCategories,
            rows: rows.map((row) => ({
              category: row.category,
              name: row.name,
              description: row.description,
              boxPrice: row.boxPrice,
              generalPrice: row.generalPrice,
              foodType: row.foodType,
              isActive: row.isActive,
              imageUrl: row.imageUrl,
            })),
          }),
        },
        session.accessToken,
      );
      setSummary(result);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setImporting(false);
    }
  }

  if (!session) return <main className="admin-page">Sign in to import menu items.</main>;

  return (
    <main className="admin-page">
      <MenuTabs />
      <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-eyebrow">Bulk menu upload</p>
          <h1 className="admin-title mt-2">Import menu items</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Preview and validate every row before committing one atomic import.</p>
        </div>
        <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Download CSV template</Button>
      </div>

      <section className="admin-card mt-7">
        <label className="grid min-h-48 cursor-pointer place-items-center rounded-2xl border-2 border-dashed bg-muted/35 p-8 text-center transition hover:border-primary/45 hover:bg-primary/5">
          <span>
            <FileSpreadsheet className="mx-auto h-10 w-10 text-primary" />
            <span className="mt-4 block font-semibold">Drop a CSV here or browse</span>
            <span className="mt-1 block text-sm text-muted-foreground">Up to 1,000 rows. Nothing is saved until validation passes.</span>
          </span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
        </label>
      </section>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      {summary && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5" /><p><strong>Import complete.</strong> {summary.created} created, {summary.updated} updated, {summary.skipped} skipped.</p></div>}

      {rows.length > 0 && (
        <section className="admin-card mt-5 p-0">
          <div className="flex flex-wrap items-end gap-4 border-b p-4">
            <div className="mr-auto"><h2 className="font-semibold">{fileName}</h2><p className="text-sm text-muted-foreground">{rows.length} rows · {issueCount} validation issues</p></div>
            <label className="text-sm font-semibold">Duplicates<Select className="mt-1 min-w-44" value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value as 'SKIP' | 'UPDATE')}><option value="UPDATE">Update matching items</option><option value="SKIP">Skip matching items</option></Select></label>
            <label className="flex h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold"><input type="checkbox" checked={createMissingCategories} onChange={(event) => setMissingCategoryPolicy(event.target.checked)} />Create missing categories</label>
            <Button onClick={() => void commitImport()} disabled={Boolean(issueCount) || importing}><UploadCloud className="mr-2 h-4 w-4" />{importing ? 'Importing…' : 'Import menu'}</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[980px]">
              <thead><tr><th>Row</th><th>Item</th><th>Category</th><th>Meal-box price</th><th>Package price</th><th>Food type</th><th>Validation</th></tr></thead>
              <tbody>{rows.slice(0, 100).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td className="font-semibold">{row.name || '—'}</td><td>{row.category || '—'}</td><td>₹{row.boxPrice || '—'}</td><td>₹{row.generalPrice || '—'}</td><td>{row.foodType.replace('_', '-')}</td><td>{row.errors.length ? <span className="inline-flex max-w-xs items-start gap-1 text-xs text-red-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{row.errors.join('; ')}</span> : <span className="text-xs font-semibold text-emerald-700">Ready</span>}</td></tr>)}</tbody>
            </table>
          </div>
          {rows.length > 100 && <p className="border-t p-4 text-sm text-muted-foreground">Showing the first 100 rows. All {rows.length} rows will be validated and imported.</p>}
        </section>
      )}
    </main>
  );
}
