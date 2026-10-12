// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from '@/hooks/fetch-json';
import type { GeocodeResult } from '@/lib/types';

export const GEOCODE_DEBOUNCE_MS = 600;
export const GEOCODE_MIN_CHARS = 3;

export type GeocodeStatus = 'idle' | 'loading' | 'done' | 'unavailable';
export interface GeocodeState {
  /** The query the results belong to, trimmed; results of an older query are never exposed. */
  query: string;
  results: GeocodeResult[];
  status: GeocodeStatus;
}

/**
 * Address search through `GET /api/store-context/geocode` (the browser never calls the geocoder). Runs 600 ms after the last
 * keystroke with at least 3 characters, cancels the previous request, and `submit()` (Enter) runs it at once.
 * A failure or `unavailable: true` leaves `results` empty so the caller keeps its text filter.
 */
export function useGeocode(rawQuery: string, locale: string): GeocodeState & { submit: () => void } {
  const query = rawQuery.trim();
  const [state, setState] = useState<GeocodeState>({ query: '', results: [], status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    async (q: string) => {
      controller.current?.abort();
      const ctl = new AbortController();
      controller.current = ctl;
      setState({ query: q, results: [], status: 'loading' });
      try {
        const data = await fetchJson<{ results: GeocodeResult[]; unavailable?: boolean }>(`/api/store-context/geocode?q=${encodeURIComponent(q)}&locale=${encodeURIComponent(locale)}`, { signal: ctl.signal });
        if (!ctl.signal.aborted) setState({ query: q, results: data.results, status: data.unavailable ? 'unavailable' : 'done' });
      } catch {
        if (!ctl.signal.aborted) setState({ query: q, results: [], status: 'unavailable' });
      }
    },
    [locale],
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.length < GEOCODE_MIN_CHARS) {
      controller.current?.abort();
      return;
    }
    timer.current = setTimeout(() => void run(query), GEOCODE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, run]);

  useEffect(() => () => controller.current?.abort(), []);

  const submit = useCallback(() => {
    if (query.length < GEOCODE_MIN_CHARS) return;
    if (timer.current) clearTimeout(timer.current);
    void run(query);
  }, [query, run]);

  // Results of an older query are hidden at once, before the next request starts.
  const current = state.query === query ? state : { query, results: [], status: 'idle' as GeocodeStatus };
  return { ...current, submit };
}
