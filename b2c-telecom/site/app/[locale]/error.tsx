'use client';

import { useEffect } from 'react';
import { ErrorView } from '@/components/errors/ErrorView';

// Segment error boundary: renders inside the locale layout, so header, footer, sign-in and bundle count are untouched.
// It performs no session or cart mutation and no fetch, and never prints error.message.
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[error-boundary]', error.digest ?? '', error);
  }, [error]);
  return <ErrorView kind="server" reference={error.digest} onRetry={reset} />;
}
