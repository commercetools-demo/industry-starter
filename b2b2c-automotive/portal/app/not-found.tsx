/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Root fallback for unsupported locales (for example /fr-FR): static text, no next-intl context here.
export default function RootNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg-page p-800">
      <section className="w-full max-w-widget-desktop-4col rounded-400 bg-bg-surface p-800 shadow-card">
        <h1 className="text-h5 font-semibold text-text">Seite nicht gefunden</h1>
        <p className="mt-200 text-body-2 text-text-subdued">Page not found</p>
      </section>
    </main>
  );
}
