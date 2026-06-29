import { ArrowRight, Home, Package, Search } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="surface-card mx-auto max-w-2xl p-8 text-center sm:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Search className="h-6 w-6" />
        </span>
        <p className="eyebrow mt-6">Page not found</p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          This page is not on the menu.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
          The link may have changed. You can return home, browse packages, or
          continue planning your catering order.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary/90"
          >
            <Home className="h-4 w-4" />
            Go home
          </Link>
          <Link
            href="/packages"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-white px-5 text-sm font-bold text-primary transition hover:border-primary/40"
          >
            <Package className="h-4 w-4" />
            Browse packages
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
