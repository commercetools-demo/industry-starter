'use client';

import { useCallback, useSyncExternalStore } from 'react';

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

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  window.addEventListener('storage', fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', fn);
  };
}

/**
 * Saved products for the session (workstream G, Q-G-12): product ids in `sessionStorage` (`mcf-saved`) for everyone.
 * Workstream L swaps this for server shopping lists and merges the session ids on sign-in; the return shape stays.
 */
export function useSavedItems() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((id: string): boolean => {
    const current = read();
    const saved = current.includes(id);
    const next = saved ? current.filter((x) => x !== id) : [...current, id];
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the heart still toggles for this page view only
    }
    listeners.forEach((l) => l());
    return !saved;
  }, []);
  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);
  return { ids, isSaved, toggle };
}
