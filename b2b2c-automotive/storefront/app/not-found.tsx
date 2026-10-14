// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

// Root fallback for unsupported locales: static German and English text, no next-intl context here.
export default function RootNotFound() {
  return (
    <main className="mx-auto max-w-content p-6 text-text">
      <title>Seite nicht gefunden | Page not found</title>
      <h1 className="font-display text-3xl text-text-strong">Seite nicht gefunden</h1>
      <p className="mt-3 font-body text-md text-text-muted">Page not found</p>
    </main>
  );
}
