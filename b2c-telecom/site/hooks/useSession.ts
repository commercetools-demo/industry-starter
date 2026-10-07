'use client';

import useSWR from 'swr';
import { KEY_SESSION } from '@/lib/cache-keys';
import { fetchJson } from '@/lib/fetcher';
import type { SessionSummary } from '@/lib/session-types';

const SESSION_URL = '/api/auth/session';

export function useSession() {
  const { data, error, isLoading, mutate } = useSWR(KEY_SESSION, () => fetchJson<{ session: SessionSummary }>(SESSION_URL));
  return { session: data?.session, isLoading, error, mutate };
}
