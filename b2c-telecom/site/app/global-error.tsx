'use client';

import { fontVariables } from './fonts';
import './globals.css';

// What remains when the locale layout itself fails: self-contained, static bilingual copy, no intl provider,
// no session, no catalog call. Own <html>/<body> as Next requires.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-5 px-5 py-10">
          <h1 className="m-0 font-display text-4xl font-bold">Something went wrong · Etwas ist schiefgelaufen</h1>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-11 items-center justify-center rounded-pill bg-action px-6 font-cta text-md font-extrabold text-text-on-pink hover:bg-action-hover"
            >
              Try again · Erneut versuchen
            </button>
            {/* A plain anchor on purpose: no intl provider exists at this level. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="inline-flex min-h-11 items-center text-text-link">
              Malva Telecom
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
