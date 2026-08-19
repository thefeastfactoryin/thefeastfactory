'use client';

import {
  ImagePlus,
  Loader2,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { apiRequest } from '../lib/api';
import { resolveMediaUrl } from '../lib/media-url';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxBytes = 5 * 1024 * 1024;

export function MediaUploader({
  value,
  onChange,
  accessToken,
  label = 'Image',
  recommended = 'Recommended: 1200 × 900 px, JPG, PNG, or WebP up to 5 MB.',
  className,
  compact = false,
}: {
  value: string;
  onChange: (url: string) => void;
  accessToken: string;
  label?: string;
  recommended?: string;
  className?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const previewUrl = resolveMediaUrl(value);
  const previewable = Boolean(previewUrl);

  async function upload(file?: File) {
    if (!file) return;
    setError('');
    setMessage('');
    if (!acceptedTypes.includes(file.type)) {
      setError('Choose a valid JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > maxBytes) {
      setError('Image must be 5 MB or smaller.');
      return;
    }

    setUploading(true);
    setMessage(`Uploading ${file.name}…`);
    try {
      const data = new FormData();
      data.append('file', file);
      const result = await apiRequest<{ url: string }>(
        '/admin/uploads/images',
        { method: 'POST', body: data },
        accessToken,
      );
      onChange(result.url);
      setMessage('Upload complete. Save this record to publish the image.');
    } catch (reason) {
      setError((reason as Error).message);
      setMessage('');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (compact) {
    return (
      <section className={cn('space-y-2', className)} aria-label={label}>
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-2.5">
          <div className="relative grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
            {previewable && (
              <img
                src={previewUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {uploading
                ? 'Uploading…'
                : value
                  ? 'Image ready'
                  : 'No image uploaded'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-xs"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : value ? (
              'Replace'
            ) : (
              'Upload'
            )}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <div aria-live="polite" className="text-xs">
          {message && <p className="text-emerald-700">{message}</p>}
          {error && <p className="text-red-700">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className={cn('space-y-3', className)} aria-label={label}>
      <div
        className={cn(
          'group relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-dashed bg-muted/55 transition',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/45',
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files?.[0]);
        }}
      >
        {value && previewable ? (
          <div className="relative grid h-full place-items-center">
            <ImagePlus className="h-9 w-9 text-muted-foreground" />
            <img
              src={previewUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="grid h-full w-full place-items-center text-center text-muted-foreground"
            onClick={() => inputRef.current?.click()}
          >
            <span>
              <ImagePlus className="mx-auto h-9 w-9" />
              <span className="mt-3 block text-sm font-semibold text-foreground">
                Drop an image here
              </span>
              <span className="mt-1 block text-xs">or browse your device</span>
            </span>
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {value ? (
            <RotateCcw className="mr-2 h-4 w-4" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          {value ? 'Replace' : 'Upload image'}
        </Button>
        {value && (
          <Button type="button" variant="outline" onClick={() => onChange('')}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">{recommended}</p>
      <div aria-live="polite" className="text-xs">
        {message && <p className="text-emerald-700">{message}</p>}
        {error && <p className="text-red-700">{error}</p>}
      </div>
    </section>
  );
}
