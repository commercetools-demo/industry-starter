'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { keySavedItemsView } from '@/lib/cache-keys';
import type { SavedList } from '@/lib/types';

const STORAGE_KEY = 'mcf-saved';
const EMPTY: readonly string[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; ids: readonly string[] } = { raw: null, ids: EMPTY };

function read(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return cache.ids;
  }
  if (raw === cache.raw) return cache.ids;
  let ids: readonly string[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    ids = EMPTY;
  }
  cache = { raw, ids };
  return ids;
}

function write(next: readonly string[]): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: the heart still toggles for this page view only
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  window.addEventListener('storage', fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', fn);
  };
}

type ListResponse = { list: SavedList | null };

const send = <T,>(method: string, url: string, body?: unknown): Promise<T> =>
  fetchJson<T>(url, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });

/** One merge per sign-in, however many hearts are on the page. */
const merging = new Map<string, Promise<void>>();

/**
 * Saved products (workstream G made it, workstream L swaps the storage; the return shape is unchanged).
 *  - Signed out: product ids in `sessionStorage` (`mcf-saved`) as before.
 *  - Signed in: the server list (`/api/shopping-lists`). The guest ids are merged into it once after sign-in (duplicates are
 *    ignored) and then removed from the browser. A toggle is optimistic and rolled back when the server refuses.
 */
export function useSavedItems() {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const { mutate } = useSWRConfig();
  const guestIds = useSyncExternalStore(subscribe, read, () => EMPTY);
  const idsKey = customerId ? keySavedItemsView(customerId, 'ids') : null;
  const { data } = useSWR<ListResponse>(idsKey, () => fetchJson<ListResponse>('/api/shopping-lists?view=ids'), {
    revalidateOnFocus: false,
  });

  const serverIds = useMemo<readonly string[]>(() => data?.list?.items.map((i) => i.productId) ?? EMPTY, [data]);
  const ids: readonly string[] = customerId ? serverIds : guestIds;

  /** Refreshes the full list (the Saved tab) after any change. */
  const refreshFull = useCallback(
    () => (customerId ? mutate(keySavedItemsView(customerId, 'full')) : Promise.resolve()),
    [customerId, mutate],
  );

  // Sign-in: merge what the guest saved.
  useEffect(() => {
    if (!customerId || !idsKey || guestIds.length === 0 || merging.has(customerId)) return;
    const job = send<ListResponse>('POST', '/api/shopping-lists', { merge: [...guestIds] })
      .then(async (res) => {
        write(EMPTY);
        await mutate(idsKey, res, { revalidate: false });
        await refreshFull();
      })
      .catch(() => undefined)
      .finally(() => merging.delete(customerId));
    merging.set(customerId, job);
  }, [customerId, idsKey, guestIds, mutate, refreshFull]);

  const toggle = useCallback(
    (id: string): boolean => {
      if (!customerId || !idsKey) {
        const current = read();
        const saved = current.includes(id);
        write(saved ? current.filter((x) => x !== id) : [...current, id]);
        return !saved;
      }
      const saved = serverIds.includes(id);
      const optimistic: ListResponse = {
        list: {
          id: data?.list?.id ?? '',
          version: data?.list?.version ?? 0,
          items: saved
            ? (data?.list?.items ?? []).filter((i) => i.productId !== id)
            : [
                { productId: id, variantId: null, lineItemId: '', addedAt: new Date().toISOString(), name: '', product: null },
                ...(data?.list?.items ?? []),
              ],
        },
      };
      void mutate(idsKey, optimistic, { revalidate: false });
      const request = saved
        ? send<ListResponse>('DELETE', `/api/shopping-lists?productId=${encodeURIComponent(id)}`)
        : send<ListResponse>('POST', '/api/shopping-lists', { productId: id });
      request
        .then(async (res) => {
          await mutate(idsKey, res, { revalidate: false });
          await refreshFull();
        })
        .catch(() => void mutate(idsKey)); // refused: read the truth back, the heart returns to its real state
      return !saved;
    },
    [customerId, idsKey, serverIds, data, mutate, refreshFull],
  );

  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);
  /** False while the signed-in list is still loading (the Saved tab then trusts its own list). */
  const ready = customerId ? data !== undefined : true;
  return { ids, isSaved, toggle, ready };
}
