'use client';
import Link from 'next/link';
import { DEFAULT_LOCALE } from '@/lib/utils';

// Last-resort boundary: it replaces the root layout, so there is no intl provider, header or SWR here.
// Copy is the en-US text of `errors.fault` (a catalog is not available when the root itself failed).
// Never renders the error message or stack; only the correlation id.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body className="font-body">
        <div className="mx-auto max-w-content px-5 py-14 nav:px-8">
          <div
            role="alert"
            data-error-kind="fault"
            className="mx-auto grid max-w-110 gap-4 rounded-lg border border-neutral-200 bg-surface p-6"
          >
            <div>
              <h1 className="font-display text-2xl font-semibold text-text-heading">Something went wrong on our side</h1>
              <p className="mt-1.5 text-sm text-neutral-600">
                This is not caused by anything you did. Your account and cart are unchanged. Please try again.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="cursor-pointer rounded-md border-thick border-action bg-action px-5.5 py-3 font-display text-sm font-medium text-action-label"
            >
              Try again
            </button>
            {/* Plain next/link: the locale router is not available here; the proxy redirects "/" to the locale. */}
            <Link href="/" className="text-center font-display text-sm font-medium text-brand-700 underline">
              Go to the home page
            </Link>
            {error.digest ? <p className="text-xs text-neutral-600">Reference: {error.digest}</p> : null}
          </div>
        </div>
      </body>
    </html>
  );
}
