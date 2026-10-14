'use client';

import useSWR from 'swr';
import { useViewer } from '@/context/ViewerContext';
import { swrFetcher } from '@/hooks/http';

/** The development-only switch, read from the address bar at fetch time (so removing it and pressing Retry works). Never in production. */
export function simulateQuery(): string {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return '';
  const value = new URLSearchParams(window.location.search).get('simulate');
  return value ? `?simulate=${encodeURIComponent(value)}` : '';
}

export interface DashboardWidgetState<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  /** Revalidates this widget's key and nothing else. */
  retry: () => void;
}

/**
 * One independent widget: its own endpoint, its own SWR key `[name, businessUnitKey, storeKey]` (a switch of unit or store
 * starts clean) and its own error state. `enabled: false` skips the request (a role that may not see the widget).
 */
export function useDashboardWidget<T>(name: string, path: string, enabled = true): DashboardWidgetState<T> {
  const viewer = useViewer();
  const { data, error, isLoading, mutate } = useSWR<T>(enabled ? [name, viewer.businessUnitKey, viewer.storeKey] : null, () => swrFetcher<T>(`${path}${simulateQuery()}`), {
    // A failed widget waits for the user's Retry instead of hammering its source.
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  return { data, error, isLoading, retry: () => void mutate() };
}
