// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { geocoderEnv } from '@/lib/env';
import type { GeocodeResult } from '@/lib/types';

// Nominatim usage policy (operations.osmfoundation.org/policies/nominatim): at most one request per second, a valid
// identifying User-Agent, results cached, no autocomplete. The browser never calls Nominatim; this module runs on the server.

export interface GeocodeOutcome {
  results: GeocodeResult[];
  /** True when the upstream failed, timed out, answered 429 or the geocoder is switched off. The picker falls back to the text filter. */
  unavailable: boolean;
}
export interface GeocodeOptions {
  /** ISO country codes of the store (`countrycodes`). */
  countries: string[];
  locale: string;
}
export interface GeocoderConfig {
  url: string;
  contact: string;
  version?: string;
  fetchFn?: typeof fetch;
  /** Minimum gap between two upstream calls. */
  minGapMs?: number;
  ttlMs?: number;
  maxEntries?: number;
  timeoutMs?: number;
  now?: () => number;
}

const UNAVAILABLE: GeocodeOutcome = { results: [], unavailable: true };

/** Lower-cases, trims and collapses whitespace: the cache key of a query. */
export const normaliseQuery = (q: string): string => q.trim().replace(/\s+/g, ' ').toLowerCase();

export function createGeocoder(config: GeocoderConfig) {
  const fetchFn = config.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const minGap = config.minGapMs ?? 1100;
  const ttl = config.ttlMs ?? 24 * 60 * 60 * 1000;
  const maxEntries = config.maxEntries ?? 500;
  const timeoutMs = config.timeoutMs ?? 2000;
  const now = config.now ?? Date.now;
  const userAgent = `malva-automotive-storefront/${config.version ?? '0.1.0'} (${config.contact})`;

  const cache = new Map<string, { value: GeocodeOutcome; expires: number }>();
  const inflight = new Map<string, Promise<GeocodeOutcome>>();
  let tail: Promise<unknown> = Promise.resolve();
  let lastCallAt = Number.NEGATIVE_INFINITY;

  async function upstream(q: string, { countries, locale }: GeocodeOptions): Promise<GeocodeOutcome> {
    const params = new URLSearchParams({ format: 'jsonv2', limit: '5', q, 'accept-language': locale });
    if (countries.length) params.set('countrycodes', countries.map((c) => c.toLowerCase()).join(','));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // No cookies, no visitor headers, no Referer: only the identifying User-Agent.
      const res = await fetchFn(`${config.url}/search?${params.toString()}`, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        referrerPolicy: 'no-referrer',
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!res.ok) return UNAVAILABLE;
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return UNAVAILABLE;
      const results: GeocodeResult[] = [];
      for (const item of data) {
        const { display_name: label, lat, lon } = (item ?? {}) as { display_name?: unknown; lat?: unknown; lon?: unknown };
        const la = Number(lat);
        const ln = Number(lon);
        if (typeof label === 'string' && Number.isFinite(la) && Number.isFinite(ln)) results.push({ label, lat: la, lng: ln });
      }
      return { results, unavailable: false };
    } catch {
      return UNAVAILABLE;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Serialises upstream calls and spaces them at least `minGap` apart. */
  function enqueue(q: string, options: GeocodeOptions): Promise<GeocodeOutcome> {
    const run = async () => {
      const wait = lastCallAt + minGap - now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastCallAt = now();
      return upstream(q, options);
    };
    const result = tail.then(run, run);
    tail = result.catch(() => undefined);
    return result;
  }

  return {
    userAgent,
    async search(rawQuery: string, options: GeocodeOptions): Promise<GeocodeOutcome> {
      const q = normaliseQuery(rawQuery);
      const key = `${q}|${options.countries.join(',')}|${options.locale}`;
      const hit = cache.get(key);
      if (hit && hit.expires > now()) return hit.value;
      const pending = inflight.get(key);
      if (pending) return pending;
      const promise = enqueue(q, options)
        .then((outcome) => {
          if (!outcome.unavailable) {
            if (cache.size >= maxEntries) cache.delete(cache.keys().next().value as string);
            cache.set(key, { value: outcome, expires: now() + ttl });
          }
          return outcome;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
  };
}

let shared: ReturnType<typeof createGeocoder> | null | undefined;

/** The app's geocoder from the environment (`GEOCODER`, `GEOCODER_URL`, `NOMINATIM_CONTACT`); `null` when it is off. */
export function getGeocoder(env: Record<string, string | undefined> = process.env): ReturnType<typeof createGeocoder> | null {
  if (shared !== undefined) return shared;
  const cfg = geocoderEnv(env);
  shared = cfg.enabled ? createGeocoder({ url: cfg.url, contact: cfg.contact }) : null;
  return shared;
}

/** Looks a place up; `{ results: [], unavailable: true }` when the geocoder is off or the upstream is not usable. */
export async function geocode(q: string, options: GeocodeOptions): Promise<GeocodeOutcome> {
  const geocoder = getGeocoder();
  return geocoder ? geocoder.search(q, options) : UNAVAILABLE;
}
