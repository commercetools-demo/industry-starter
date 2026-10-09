'use client';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

/** No server-provided fallback: layouts never read the session (D20), so per-visitor data is fetched after hydration. */
export function SwrProvider({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ shouldRetryOnError: false, dedupingInterval: 2000 }}>{children}</SWRConfig>;
}
