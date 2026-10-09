'use client';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

/** Client wrapper so the server-built, serializable fallback can seed SWR (no function props cross the boundary). */
export function SwrProvider({ fallback, children }: { fallback: Record<string, unknown>; children: ReactNode }) {
  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
}
