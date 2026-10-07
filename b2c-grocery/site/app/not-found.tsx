/** Root not-found for URLs outside any locale (rendered inside the root layout; no intl provider: English only). */
export default function RootNotFound() {
  return (
    <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
      <h1>We could not find that page</h1>
      <p>The page may have moved or never existed.</p>
      {/* Plain anchor on purpose: no intl provider here; the proxy redirects "/" to the visitor's locale. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn btn-primary">
        Back to the shop
      </a>
    </div>
  );
}
