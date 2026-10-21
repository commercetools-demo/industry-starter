'use client';

import ErrorPage from '@/components/error/ErrorPage';

/**
 * 500 inside the locale layout. It touches no cookie, SWR cache or session, so the shopper's bag and account stay as they were.
 * Shows only the digest, never the message. `retry` re-fetches (Next 16.3+); `reset` is the fallback for older boundaries.
 */
export default function LocaleError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <ErrorPage kind="server-error" reference={error.digest} onRetry={retry ?? reset} />;
}
