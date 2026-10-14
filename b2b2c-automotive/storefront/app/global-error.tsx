// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

// Last-resort boundary: replaces the root layout, so it renders its own html and body. Static text, no providers.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de-DE">
      <body>
        <main>
          <h1>Etwas ist schiefgelaufen / Something went wrong</h1>
          <button type="button" onClick={reset}>
            Erneut versuchen / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
