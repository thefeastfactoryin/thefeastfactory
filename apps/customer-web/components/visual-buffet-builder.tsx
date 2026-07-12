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
  { id: 'top-left', x: 30, y: 32, rotation: -2, size: 'md' },
  { id: 'top-center', x: 46, y: 27, rotation: 1, size: 'md' },
  { id: 'top-right', x: 61, y: 30, rotation: 2, size: 'md' },
  { id: 'right-upper', x: 76, y: 43, rotation: 5, size: 'md' },
  { id: 'right-lower', x: 80, y: 66, rotation: 8, size: 'md' },
  { id: 'bottom-right', x: 64, y: 79, rotation: 1, size: 'md' },
  { id: 'bottom-center', x: 49, y: 82, rotation: 0, size: 'md' },
  { id: 'bottom-left', x: 34, y: 78, rotation: -3, size: 'md' },
  { id: 'left-lower', x: 22, y: 63, rotation: -9, size: 'md' },
  { id: 'left-upper', x: 20, y: 45, rotation: -7, size: 'md' },
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
  if (size === 'lg') return 'h-24 w-32 sm:h-28 sm:w-40';
  if (size === 'md') return 'h-20 w-28 sm:h-24 sm:w-32';
  return 'h-16 w-24 sm:h-20 sm:w-28';
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
          'visual-tray relative rounded-[1rem] border border-amber-200/70 bg-gradient-to-br from-amber-200 via-yellow-500 to-amber-800 p-0.5 shadow-[0_16px_28px_-20px_rgba(61,34,5,0.75)]',
          traySizeClass(slot.size),
        )}
      >
        <div className="relative h-full overflow-hidden rounded-[0.85rem] border border-white/50 bg-gradient-to-br from-stone-100 via-zinc-300 to-stone-500">
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
                <Plus className="mx-auto h-5 w-5" />
                <span className="mt-0.5 block text-[11px] font-semibold">
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
    <section className="visual-table relative isolate min-h-[430px] w-full max-w-full overflow-hidden rounded-lg border border-border/70 bg-stone-200 shadow-none sm:aspect-[16/9] sm:min-h-0">
      <img
        src="/buffet-table-builder-bg.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/12" />

      <div className="absolute left-1/2 top-[55%] z-0 w-72 -translate-x-1/2 -translate-y-1/2 text-center text-[#4b2d10]/85">
        <p className="font-serif text-3xl font-semibold leading-none sm:text-4xl">
          MY FEAST FACTORY
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#4b2d10]/70">
          Food for every celebration
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

      <div className="absolute bottom-4 left-4 z-20 rounded-md bg-white/90 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur">
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
