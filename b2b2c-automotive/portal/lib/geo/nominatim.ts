// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// "Find coordinates" for the store location and branch forms (workstream U-05, Q-U07). Adapted from
// storefront/lib/geo/nominatim.ts (workstream I). Nominatim usage policy (operations.osmfoundation.org/policies/nominatim): at
// most one request per second, a valid identifying User-Agent, results cached, no autocomplete. The browser never calls
// Nominatim; this module runs on the server. A failure leaves manual entry of latitude and longitude.
import 'server-only';

export interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
}

export interface GeocodeOutcome {
  /** The best match, or null when there is none. */
  result: GeocodeHit | null;
  /** True when the upstream failed, timed out, answered 429 or the geocoder is not reachable. */
  unavailable: boolean;
}

export interface GeocoderConfig {
  url?: string;
  /** The `User-Agent` sent upstream; the usage policy wants an identifying application name and a contact. */
  userAgent: string;
  fetchFn?: typeof fetch;
  minGapMs?: number;
  ttlMs?: number;
  maxEntries?: number;
  timeoutMs?: number;
  now?: () => number;
}

const UNAVAILABLE: GeocodeOutcome = { result: null, unavailable: true };

/** Lower-cases, trims and collapses whitespace: the cache key of a query. */
export const normaliseQuery = (q: string): string => q.trim().replace(/\s+/g, ' ').toLowerCase();

export function createGeocoder(config: GeocoderConfig) {
  const fetchFn = config.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const url = config.url ?? 'https://nominatim.openstreetmap.org';
  const minGap = config.minGapMs ?? 1100;
  const ttl = config.ttlMs ?? 24 * 60 * 60 * 1000;
  const maxEntries = config.maxEntries ?? 500;
  const timeoutMs = config.timeoutMs ?? 3000;
  const now = config.now ?? Date.now;

  const cache = new Map<string, { value: GeocodeOutcome; expires: number }>();
  const inflight = new Map<string, Promise<GeocodeOutcome>>();
  let tail: Promise<unknown> = Promise.resolve();
  let lastCallAt = Number.NEGATIVE_INFINITY;

  async function upstream(q: string): Promise<GeocodeOutcome> {
    const params = new URLSearchParams({ format: 'jsonv2', limit: '1', q });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // No cookies, no visitor headers, no Referer: only the identifying User-Agent.
      const res = await fetchFn(`${url}/search?${params.toString()}`, {
        headers: { 'User-Agent': config.userAgent, Accept: 'application/json' },
        referrerPolicy: 'no-referrer',
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!res.ok) return UNAVAILABLE;
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return UNAVAILABLE;
      for (const item of data) {
        const { display_name: label, lat, lon } = (item ?? {}) as { display_name?: unknown; lat?: unknown; lon?: unknown };
        const la = Number(lat);
        const ln = Number(lon);
        if (typeof label === 'string' && Number.isFinite(la) && Number.isFinite(ln)) return { result: { label, lat: la, lng: ln }, unavailable: false };
      }
      return { result: null, unavailable: false };
    } catch {
      return UNAVAILABLE;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Serialises upstream calls and spaces them at least `minGap` apart. */
  function enqueue(q: string): Promise<GeocodeOutcome> {
    const run = async () => {
      const wait = lastCallAt + minGap - now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastCallAt = now();
      return upstream(q);
    };
    const result = tail.then(run, run);
    tail = result.catch(() => undefined);
    return result;
  }

  return {
    async search(rawQuery: string): Promise<GeocodeOutcome> {
      const key = normaliseQuery(rawQuery);
      const hit = cache.get(key);
      if (hit && hit.expires > now()) return hit.value;
      const pending = inflight.get(key);
      if (pending) return pending;
      const promise = enqueue(key)
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

let shared: ReturnType<typeof createGeocoder> | undefined;

/** `GEOCODER_USER_AGENT` or a default that names the app (set a contact in production). */
export const geocoderUserAgent = (env: Record<string, string | undefined> = process.env): string => env.GEOCODER_USER_AGENT?.trim() || 'malva-partner-portal/0.1.0 (set GEOCODER_USER_AGENT)';

/** Looks an address up with the shared, rate-limited geocoder. */
export async function geocodeAddress(address: string): Promise<GeocodeOutcome> {
  shared ??= createGeocoder({ userAgent: geocoderUserAgent() });
  return shared.search(address);
}
