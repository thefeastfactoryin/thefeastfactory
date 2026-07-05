'use client';

import { Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DataImage } from './data-image';

export type VisualBuffetItem = {
  menuItemId: string;
  menuItemName: string;
  categoryName: string;
  isVeg: boolean;
  imageUrl?: string | null;
  replacedMenuItemId?: string | null;
  canRemove?: boolean;
};

type BuffetSlot = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  size: 'sm' | 'md' | 'lg';
};

const desktopSlots: BuffetSlot[] = [
  { id: 'top-left', x: 32, y: 22, rotation: -10, size: 'lg' },
  { id: 'top-center', x: 50, y: 16, rotation: 1, size: 'lg' },
  { id: 'top-right', x: 68, y: 22, rotation: 10, size: 'lg' },
  { id: 'right-upper', x: 84, y: 39, rotation: 15, size: 'md' },
  { id: 'right-lower', x: 79, y: 66, rotation: -11, size: 'md' },
  { id: 'bottom-right', x: 61, y: 80, rotation: 2, size: 'md' },
  { id: 'bottom-center', x: 45, y: 84, rotation: -4, size: 'md' },
  { id: 'bottom-left', x: 29, y: 76, rotation: 8, size: 'md' },
  { id: 'left-lower', x: 18, y: 56, rotation: -14, size: 'md' },
  { id: 'left-upper', x: 17, y: 34, rotation: 12, size: 'sm' },
];

const mobileSlots: BuffetSlot[] = [
  { id: 'mobile-top-left', x: 30, y: 19, rotation: -11, size: 'md' },
  { id: 'mobile-top-center', x: 50, y: 13, rotation: 2, size: 'md' },
  { id: 'mobile-top-right', x: 70, y: 19, rotation: 10, size: 'md' },
  { id: 'mobile-right', x: 76, y: 45, rotation: 8, size: 'sm' },
  { id: 'mobile-bottom', x: 50, y: 75, rotation: 0, size: 'lg' },
  { id: 'mobile-left-lower', x: 27, y: 56, rotation: -10, size: 'sm' },
  { id: 'mobile-left-upper', x: 23, y: 38, rotation: 7, size: 'sm' },
];

function traySizeClass(size: BuffetSlot['size']) {
  if (size === 'lg') return 'h-28 w-36 sm:h-32 sm:w-44';
  if (size === 'md') return 'h-24 w-32 sm:h-28 sm:w-36';
  return 'h-20 w-28 sm:h-24 sm:w-32';
}

function BuffetTray({
  item,
  slot,
  onAdd,
  onRemove,
}: {
  item?: VisualBuffetItem;
  slot: BuffetSlot;
  onAdd: () => void;
  onRemove: (menuItemId: string, replacedMenuItemId?: string | null) => void;
}) {
  const canRemove = item?.canRemove ?? true;
  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: `translate(-50%, -50%) rotate(${slot.rotation}deg)`,
      }}
    >
      <div
        className={cn(
          'visual-tray relative rounded-[1.35rem] border border-amber-200/90 bg-gradient-to-br from-amber-200 via-yellow-500 to-amber-800 p-1 shadow-[0_18px_35px_-20px_rgba(61,34,5,0.75)]',
          traySizeClass(slot.size),
        )}
      >
        <div className="relative h-full overflow-hidden rounded-[1.05rem] border border-white/50 bg-gradient-to-br from-stone-100 via-zinc-300 to-stone-500">
          {item ? (
            <div className="visual-tray-fill h-full">
              <DataImage
                src={item.imageUrl}
                alt={item.menuItemName}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded-full bg-white/92 px-2 py-1 text-[10px] font-bold shadow-sm backdrop-blur">
                <span className="min-w-0 truncate">{item.menuItemName}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 uppercase',
                    item.isVeg
                      ? 'bg-green-50 text-green-700'
                      : 'bg-orange-50 text-orange-700',
                  )}
                >
                  {item.isVeg ? 'Veg' : 'Non'}
                </span>
              </div>
              {canRemove && (
                <button
                  type="button"
                  onClick={() =>
                    onRemove(item.menuItemId, item.replacedMenuItemId)
                  }
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-primary shadow-sm hover:bg-primary hover:text-white"
                  aria-label={`Remove ${item.menuItemName}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="grid h-full w-full place-items-center text-center text-white/95 transition hover:bg-white/10"
              aria-label="Open menu to add an item"
            >
              <span>
                <Plus className="mx-auto h-7 w-7" />
                <span className="mt-1 block text-xs font-semibold">
                  Add item
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function VisualBuffetBuilder({
  items,
  onAdd,
  onRemove,
}: {
  items: VisualBuffetItem[];
  onAdd: () => void;
  onRemove: (menuItemId: string, replacedMenuItemId?: string | null) => void;
}) {
  const maxSlots = Math.max(desktopSlots.length, mobileSlots.length);
  const visibleItems = items.slice(0, maxSlots);

  return (
    <section className="visual-table relative isolate min-h-[560px] w-full max-w-full overflow-hidden rounded-xl border border-white/70 bg-[hsl(var(--muted))] shadow-[0_28px_80px_-45px_rgba(111,29,45,0.55)] sm:aspect-[16/10] sm:min-h-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.95)_0,rgba(255,246,226,0.92)_30%,rgba(203,151,79,0.58)_67%,rgba(101,44,32,0.24)_100%)]" />
      <div className="absolute left-1/2 top-[52%] h-[72%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-amber-200/70 bg-[radial-gradient(circle,rgba(255,255,255,0.62),rgba(248,229,190,0.42)_62%,rgba(126,72,35,0.2))] shadow-inner" />
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_12%_20%,rgba(255,255,255,0.92),transparent_5rem),radial-gradient(circle_at_88%_24%,rgba(255,255,255,0.85),transparent_5rem)] opacity-90" />

      <div className="absolute left-1/2 top-1/2 z-0 w-64 -translate-x-1/2 -translate-y-1/2 text-center text-primary/80">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-primary/30 bg-white/45 text-2xl font-bold shadow-sm">
          TFF
        </div>
        <p className="mt-3 font-serif text-4xl font-semibold leading-none">
          The Feast Factory
        </p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.26em] text-primary/60">
          Great food. Lasting impressions.
        </p>
      </div>

      <div className="hidden sm:block">
        {desktopSlots.map((slot, index) => (
          <BuffetTray
            key={slot.id}
            slot={slot}
            item={visibleItems[index]}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ))}
      </div>
      <div className="sm:hidden">
        {mobileSlots.map((slot, index) => (
          <BuffetTray
            key={slot.id}
            slot={slot}
            item={visibleItems[index]}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ))}
      </div>

      <div className="absolute bottom-4 left-4 z-20 rounded-full bg-white/92 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </div>
      {items.length > maxSlots && (
        <div className="absolute bottom-4 right-4 z-20 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm">
          +{items.length - maxSlots} more in summary
        </div>
      )}
    </section>
  );
}
