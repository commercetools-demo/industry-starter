import type { Channel } from '@commercetools/platform-sdk';
import { CLOSED_ALL_WEEK, WEEKDAYS } from '@/lib/hours';
import { COLLECTION_MINUTES_FALLBACK } from '@/lib/shop-config';
import type { OpeningHours, Store } from '@/lib/types';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, getLocalizedString, marketForCountry } from '@/lib/utils';

/** Seeded store channels (SEED-PLAN section 5). Anything else with the InventorySupply role is not a store. */
export const STORE_KEY_PREFIX = 'mcf-store-';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Parses the `hours` custom field: JSON text by weekday, `{"mon":{"open":"07:00","close":"18:00"},"sun":null}`.
 * A missing day is closed. Anything malformed returns null so the caller can log and close the week.
 */
export function parseHours(raw: unknown): OpeningHours | null {
  if (typeof raw !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const out: OpeningHours = { ...CLOSED_ALL_WEEK };
  for (const day of WEEKDAYS) {
    const value = record[day];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'object') return null;
    const { open, close } = value as { open?: unknown; close?: unknown };
    if (typeof open !== 'string' || typeof close !== 'string' || !TIME.test(open) || !TIME.test(close)) return null;
    if (open >= close) return null;
    out[day] = { open, close };
  }
  return out;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Channel to Store. The custom fields win over the structured address (the seed fills both). */
export function mapChannel(c: Channel, locale: string): Store | null {
  if (!c.key?.startsWith(STORE_KEY_PREFIX)) return null;
  if (!c.roles.includes('InventorySupply')) return null;

  const fields = (c.custom?.fields ?? {}) as Record<string, unknown>;
  const address = c.address;
  const country = address?.country ?? 'US';

  const hours = parseHours(fields.hours);
  if (!hours) {
    // Key only: no address, phone or hours text in the log line.
    console.warn(JSON.stringify({ event: 'store_hours_invalid', channelKey: c.key }));
  }

  const minutes = fields.collectionMinutes;
  const streetLine = [address?.streetNumber, address?.streetName].filter(Boolean).join(' ');
  const market = marketForCountry(country) ?? DEFAULT_LOCALE;

  const store: Store = {
    id: c.id,
    key: c.key,
    name: getLocalizedString(c.name, locale) || c.key,
    addressLine: text(fields.addressLine) ?? streetLine,
    city: text(fields.city) ?? address?.city ?? '',
    postalCode: text(fields.postalCode) ?? address?.postalCode ?? '',
    country,
    hours: hours ?? CLOSED_ALL_WEEK,
    timeZone: market.timeZone ?? COUNTRY_CONFIG['en-US'].timeZone,
    collectionMinutes:
      typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
        ? Math.round(minutes)
        : COLLECTION_MINUTES_FALLBACK,
  };
  const phone = text(fields.phone) ?? address?.phone;
  if (phone) store.phone = phone;
  // GeoJSON order is [longitude, latitude].
  const coords = c.geoLocation?.coordinates;
  if (coords && coords.length >= 2) store.geo = { lat: coords[1], lng: coords[0] };
  return store;
}

/** Keeps only stores, sorted by city then name. */
export function mapChannels(channels: Channel[], locale: string): Store[] {
  return channels
    .map((c) => mapChannel(c, locale))
    .filter((s): s is Store => s !== null)
    .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
}
