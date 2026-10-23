import { COUNTRY_CONFIG } from '@/lib/utils';

/**
 * A country sent by the client (the market of the page URL), if it is one we serve. The URL's market and the session's
 * market can differ (someone opens /en-US with a Canadian session); store and availability reads follow the page.
 */
export function knownCountry(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value)) return null;
  return Object.values(COUNTRY_CONFIG).some((m) => m.country === value) ? value : null;
}
