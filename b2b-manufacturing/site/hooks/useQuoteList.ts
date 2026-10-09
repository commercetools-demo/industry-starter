'use client';
import useSWR from 'swr';
import { buKey, KEY_CART } from '@/lib/cache-keys';
import { SendError } from '@/lib/fetcher';
import type { QuoteList } from '@/lib/types';
import { useAccount } from './useAccount';

/** The page's locale, so a visitor who opened a `/de-DE` link directly still gets a list in EUR. */
export const LOCALE_HEADER = 'x-malva-locale';
const EMPTY: QuoteList = { id: null, lines: [], count: 0 };

/** The quote list (a cart in the default store). Keyed by Business Unit; the page's locale rides along so the list follows its currency. */
export function useQuoteList() {
  const { account } = useAccount();
  const key = buKey(KEY_CART, account?.businessUnitKey);
  const locale = typeof window === 'undefined' ? '' : window.location.pathname.split('/')[1] ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(locale ? { [LOCALE_HEADER]: locale } : {}) };
  async function read(): Promise<QuoteList | null> {
    try {
      const res = await fetch('/api/quote-list', { credentials: 'same-origin', headers });
      return res.ok ? ((await res.json()) as QuoteList) : null;
    } catch {
      return null;
    }
  }
  const { data, isLoading, mutate } = useSWR(key, read, { revalidateOnFocus: false });
  const list = data ?? EMPTY;

  /** Throws on failure; on success the cache is set from the response body, no refetch. */
  async function update(method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown) {
    const res = await fetch(url, { method, credentials: 'same-origin', headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const next = (await res.json().catch(() => ({}))) as QuoteList & { error?: string };
    if (!res.ok) throw new SendError(next.error ?? 'Request failed', res.status, next as unknown as Record<string, unknown>);
    await mutate(next, { revalidate: false });
    return next;
  }
  /** `failed` is true when the list could not be read (as opposed to being empty). */
  return { list, count: list.count, isLoading, failed: !isLoading && data === null, update, reload: () => mutate() };
}
