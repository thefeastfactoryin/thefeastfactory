import { cn } from '../lib/utils';

export function DataImage({ src, alt, className }: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (src) return <img src={src} alt={alt} className={className} />;
  return (
    <div
      className={cn('grid place-items-center bg-muted/70', className)}
      role="img"
      aria-label={`${alt} image unavailable`}
    >
      <img
        src="/logo.png"
        alt=""
        className="h-14 w-14 rounded-xl object-cover opacity-55 grayscale"
      />
    </div>
  );
}
