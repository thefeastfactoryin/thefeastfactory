import { cn } from '../lib/utils';

export function DataImage({ src, alt, className }: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (src) {
    const isLocalMenuImage =
      src.startsWith('/menu-images/') && src.endsWith('/large.jpg');
    const mediumSrc = isLocalMenuImage
      ? src.replace(/\/large\.jpg$/, '/medium.jpg')
      : undefined;
    const thumbSrc = isLocalMenuImage
      ? src.replace(/\/large\.jpg$/, '/thumb.jpg')
      : undefined;

    return (
      <img
        src={src}
        srcSet={
          isLocalMenuImage
            ? `${thumbSrc} 192w, ${mediumSrc} 640w, ${src} 1200w`
            : undefined
        }
        sizes={isLocalMenuImage ? '(max-width: 640px) 50vw, 400px' : undefined}
        alt={alt}
        className={className}
      />
    );
  }
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
