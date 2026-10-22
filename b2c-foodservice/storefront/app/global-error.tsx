'use client';

import { useSyncExternalStore } from 'react';
import { GLOBAL_ERROR_DICTIONARY, localeFromPath, type GlobalErrorLocale } from '@/components/error/global-error-dictionary';
import './globals.css';

/**
 * Last resort when the root layout itself fails. Own html and body, tokens from the global stylesheet, an inline
 * two-locale dictionary, no session, no commerce, no provider. Shows only the digest, never the error message.
 */
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  // The language comes from the first path segment; the server snapshot is the default locale.
  const locale = useSyncExternalStore<GlobalErrorLocale>(
    () => () => {},
    () => localeFromPath(window.location.pathname),
    () => 'en-US',
  );
  const t = GLOBAL_ERROR_DICTIONARY[locale];
  const onRetry = retry ?? reset;
  return (
    <html lang={locale}>
      <body className="bg-canvas text-ink font-body">
        <title>{t.title}</title>
        <main className="wrap py-24">
          <div className="max-w-[640px]">
            <p className="eyebrow m-0 mb-3">500</p>
            <div role="alert">
              <h1 className="page-title m-0">{t.title}</h1>
              <p className="mt-4 text-[17px] text-ink-2">{t.text}</p>
            </div>
            {error.digest ? (
              <p className="m-0 mt-3 font-mono text-[13px] text-ink-2">
                {t.reference} {error.digest}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="cursor-pointer rounded-pill border border-transparent bg-ink px-[26px] py-[14px] text-[14px] font-semibold text-surface"
                >
                  {t.retry}
                </button>
              ) : null}
              <a href={`/${locale}`} className="rounded-pill border border-line-2 px-[26px] py-[14px] text-[14px] font-semibold text-ink">
                {t.home}
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
