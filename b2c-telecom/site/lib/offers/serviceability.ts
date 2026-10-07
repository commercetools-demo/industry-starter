import type { AvailabilityState, CountryCode, ServiceLocation, Technology } from '@/lib/types';

// Pure: no I/O. The singleton that reads SERVICEABILITY_STUB lives in lib/ct/serviceability.ts (D-020: stubbed provider).

export const TECHNOLOGIES: readonly Technology[] = ['cable', 'fixed-wireless', 'mobile'];

export type ServedMap = Record<Technology, boolean>;
export type ServiceabilityAnswer = Pick<ServiceLocation, 'postalCode' | 'country' | 'served' | 'anyServed'>;

export interface ServiceabilityProvider {
  check(postalCode: string, country: CountryCode): Promise<ServiceabilityAnswer>;
}

/**
 * Trims; US: 5 digits or ZIP+4 (12345-6789 becomes 12345); DE: exactly 5 digits. Anything else (letters, 4 or 6 digits,
 * empty) gives null.
 */
export function normalizePostalCode(raw: string, country: CountryCode): string | null {
  const value = raw.trim();
  if (country === 'DE') return /^\d{5}$/.test(value) ? value : null;
  const match = /^(\d{5})(?:-\d{4})?$/.exec(value);
  return match ? match[1] : null;
}

const served = (cable: boolean, wireless: boolean, mobile: boolean): ServedMap => ({ cable, 'fixed-wireless': wireless, mobile });
const NONE = served(false, false, false);
const ALL = served(true, true, true);

/** Demonstration table, key = `${country}:${zip}`. */
export const SEEDED_ZIPS: Record<string, { place: string; served: ServedMap }> = {
  'US:10001': { place: 'New York', served: ALL },
  'US:94105': { place: 'San Francisco', served: ALL },
  'US:60601': { place: 'Chicago', served: served(true, false, true) },
  'US:73301': { place: 'Austin', served: served(false, true, true) },
  'US:59001': { place: 'rural Montana', served: served(false, false, true) },
  'US:99999': { place: 'not served', served: NONE },
  'DE:10115': { place: 'Berlin', served: ALL },
  'DE:80331': { place: 'München', served: served(true, false, true) },
  'DE:01067': { place: 'Dresden', served: served(false, true, true) },
  'DE:99998': { place: 'not served', served: NONE },
};

export type StubMode = 'table' | 'all' | 'none';

const anyOf = (map: ServedMap): boolean => map.cable || map['fixed-wireless'] || map.mobile;

/** `table` (default): a ZIP missing from the table is served on all three technologies (optimistic demo behaviour). */
export function createStubProvider(mode: StubMode): ServiceabilityProvider {
  return {
    async check(postalCode, country) {
      const map: ServedMap = mode === 'all' ? ALL : mode === 'none' ? NONE : (SEEDED_ZIPS[`${country}:${postalCode}`]?.served ?? ALL);
      return { postalCode, country, served: { ...map }, anyServed: anyOf(map) };
    },
  };
}

/**
 * Per-instance TTL cache in front of a provider. A cached answer is never kept for `ttlSeconds` or longer; `checkedAt` is the
 * time the provider was called. Invalid ZIPs throw `RangeError` (callers validate with `normalizePostalCode` first).
 */
export function createCachedServiceability(
  provider: ServiceabilityProvider,
  ttlSeconds: number,
  now: () => number = Date.now,
): { check(rawPostalCode: string, country: CountryCode): Promise<ServiceLocation> } {
  const cache = new Map<string, { at: number; value: ServiceLocation }>();
  return {
    async check(rawPostalCode, country) {
      const postalCode = normalizePostalCode(rawPostalCode, country);
      if (postalCode === null) throw new RangeError('Invalid postal code');
      const key = `${country}:${postalCode}`;
      const hit = cache.get(key);
      if (hit && now() - hit.at < ttlSeconds * 1000) return hit.value;
      const at = now();
      const answer = await provider.check(postalCode, country);
      const value: ServiceLocation = { ...answer, checkedAt: new Date(at).toISOString() };
      cache.set(key, { at, value });
      return value;
    },
  };
}

/** No location: `no-location`; nothing served: `not-served` (the UI says so instead of rendering an empty catalog). */
export function describeAvailability(location?: ServiceLocation): { state: AvailabilityState; technologies: Technology[] } {
  if (!location) return { state: 'no-location', technologies: [] };
  const technologies = TECHNOLOGIES.filter((technology) => location.served[technology]);
  if (technologies.length === 0) return { state: 'not-served', technologies };
  return { state: technologies.length === TECHNOLOGIES.length ? 'served' : 'partially-served', technologies };
}
