'use client';
import useSWR from 'swr';
import { buKey, KEY_SITES } from '@/lib/cache-keys';
import { readJson, sendJson } from '@/lib/fetcher';
import type { SiteInput, SitesResult } from '@/lib/portal/types';
import { useAccount } from './useAccount';

/** The company's sites (Business Unit addresses). Mutations return the new list, which becomes the cache without a refetch. */
export function useSites() {
  const { account, isLoading: accountLoading } = useAccount();
  const bu = account?.businessUnitKey;
  const { data, isLoading, mutate } = useSWR(bu ? buKey(KEY_SITES, bu) : null, () => readJson<SitesResult>('/api/sites'));

  async function send(method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown) {
    const next = await sendJson<SitesResult>(url, method, body);
    await mutate(next, { revalidate: false });
    return next;
  }
  return {
    sites: data?.sites ?? [], canEdit: data?.canEdit ?? false, isLoading: accountLoading || isLoading, failed: !isLoading && !data && Boolean(bu),
    add: (input: SiteInput) => send('POST', '/api/sites', input),
    update: (key: string, input: SiteInput) => send('PATCH', `/api/sites/${encodeURIComponent(key)}`, input),
    remove: (key: string) => send('DELETE', `/api/sites/${encodeURIComponent(key)}`),
    makeDefault: (key: string) => send('POST', `/api/sites/${encodeURIComponent(key)}/default`),
  };
}
