'use client';

import { useEffect } from 'react';

/** Last-resort boundary (replaces the root layout): no intl available, so English only. */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
          <h1>Something went wrong</h1>
          <p>We could not load the page. Please reload and try again.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
