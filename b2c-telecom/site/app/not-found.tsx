// Outside any locale (no intl provider, no data calls): static bilingual copy and a plain link.
export default function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-5 px-5 py-10">
      <h1 className="m-0 font-display text-4xl font-bold">Page not found · Seite nicht gefunden</h1>
      <p className="m-0 font-body text-lg text-text-muted">
        {/* A plain anchor on purpose: there is no intl provider here, so the locale-aware Link cannot be used. The proxy redirects "/" into the locale. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="text-text-link">
          Malva Telecom
        </a>
      </p>
    </main>
  );
}
