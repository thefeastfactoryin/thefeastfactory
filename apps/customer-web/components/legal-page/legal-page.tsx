import type { legalPages } from '@aranyam/shared-types';

type LegalPageContent = (typeof legalPages)[keyof typeof legalPages];

export function LegalPage({ page }: { page: LegalPageContent }) {
  return (
    <main className="page-shell pb-24">
      <div className="max-w-3xl">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">
          {page.title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          {page.summary}
        </p>
      </div>
      <section className="mt-10 grid gap-5">
        {page.sections.map((section) => (
          <article key={section.title} className="surface-card p-6">
            <h2 className="font-serif text-2xl font-semibold">
              {section.title}
            </h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              {section.body}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
