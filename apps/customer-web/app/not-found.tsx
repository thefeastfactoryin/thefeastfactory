import Link from 'next/link';
import { Button } from '../components/ui/button';

export default function NotFound() {
  return (
    <main className="page-shell grid min-h-[60vh] place-items-center pb-24 text-center">
      <div className="max-w-xl">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">
          This page is not on the menu.
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          The page may have moved, or the link may be incomplete.
        </p>
        <Button asChild className="mt-7">
          <Link href="/packages">Browse packages</Link>
        </Button>
      </div>
    </main>
  );
}
