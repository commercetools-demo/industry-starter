'use client';
import useSWR from 'swr';
import { KEY_ACCOUNT } from '@/lib/cache-keys';
import { readJson } from '@/lib/fetcher';
import type { Account } from '@/lib/types';

/** Placeholder until sign-in exists (workstream N): the endpoint answers 404/401, so the hook returns `null`. */
export function useAccount() {
  const { data, isLoading, mutate } = useSWR<Account | null>(KEY_ACCOUNT, () => readJson<Account>('/api/auth/me'), { revalidateOnFocus: false });
  return { account: data ?? null, isLoading, mutate };
}
