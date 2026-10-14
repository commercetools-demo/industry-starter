// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Input schemas of the Store & channels screens (workstream U-05), shared by the forms and the Route Handlers. Pure: no
// server imports. Strict objects, so a client can never smuggle a field (an id, a key or a role) into a write.
import { z } from 'zod';

export const LANGUAGES = ['de-DE', 'en-US'] as const;
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const PICKUP_MODES = ['same-day', 'next-day', 'ship-to-store'] as const;
export type PickupMode = (typeof PICKUP_MODES)[number];

export const STORE_KEY = z.string().regex(/^[A-Za-z0-9_-]{2,256}$/, 'Invalid store');
const optionalText = (max: number) => z.string().trim().max(max, `At most ${max} characters`).optional();

export const nameSchema = z.object(
  Object.fromEntries(LANGUAGES.map((l) => [l, z.string().trim().min(2, 'Enter a name of 2 to 80 characters').max(80, 'Enter a name of 2 to 80 characters')])) as Record<(typeof LANGUAGES)[number], z.ZodString>,
).strict();

const latitude = z.number({ message: 'Latitude must be a number' }).min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90');
const longitude = z.number({ message: 'Longitude must be a number' }).min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180');
const bothOrNeither = (v: { latitude?: number; longitude?: number }) => (v.latitude === undefined) === (v.longitude === undefined);

export const locationSchema = z
  .object({
    addressLine: optionalText(120),
    postalCode: optionalText(20),
    city: optionalText(80),
    countryCode: z.string().regex(/^[A-Z]{2}$/, 'Use a two-letter country code, for example DE').optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
  })
  .strict()
  .refine(bothOrNeither, { message: 'Enter both latitude and longitude, or neither' });

export type StoreLocationInput = z.infer<typeof locationSchema>;

export const storeSettingsInput = z.object({ storeKey: STORE_KEY, name: nameSchema, location: locationSchema }).strict();
export type StoreSettingsInput = z.infer<typeof storeSettingsInput>;

/** Logo and favicon URLs are `https:` or the Contentools origin (development uses `http://localhost`). */
export function isAllowedAssetUrl(value: string, contentoolsOrigin: string): boolean {
  try {
    const url = new URL(value);
    if (url.search || url.hash || url.username || url.password) return false;
    return url.protocol === 'https:' || (contentoolsOrigin !== '' && url.origin === new URL(contentoolsOrigin).origin);
  } catch {
    return false;
  }
}

// ---- branches ----

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const hoursPair = z
  .tuple([z.string().regex(TIME, 'Use HH:MM'), z.string().regex(TIME, 'Use HH:MM')])
  .refine(([open, close]) => close > open, { message: 'Closing time must be after opening time' });

export const openingHoursSchema = z.object(Object.fromEntries(WEEKDAYS.map((d) => [d, hoursPair.optional()])) as Record<Weekday, z.ZodOptional<typeof hoursPair>>).strict();
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export function isIanaTimezone(value: string): boolean {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const addressSchema = z
  .object({
    streetName: z.string().trim().min(2, 'Enter the street').max(80),
    streetNumber: optionalText(10),
    postalCode: z.string().trim().min(2, 'Enter the postal code').max(12),
    city: z.string().trim().min(2, 'Enter the city').max(60),
    country: z.string().regex(/^[A-Z]{2}$/, 'Use a two-letter country code, for example DE'),
  })
  .strict();

export const branchInput = z
  .object({
    storeKey: STORE_KEY,
    name: nameSchema,
    address: addressSchema,
    geoLocation: z.object({ lat: latitude, lng: longitude }).strict().optional(),
    openingHours: openingHoursSchema,
    timezone: z.string().refine(isIanaTimezone, 'Use an IANA time zone, for example Europe/Berlin'),
    pickupMode: z.enum(PICKUP_MODES),
    phone: z.string().trim().max(30, 'At most 30 characters').optional(),
  })
  .strict();
export type BranchInput = z.infer<typeof branchInput>;

export const createBranchInput = branchInput.extend({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower case letters, digits and hyphens').min(2).max(40) }).strict();
export type CreateBranchInput = z.infer<typeof createBranchInput>;

/** `mau-br-<store suffix>-<slug>` where the suffix is the store key without `mau-reseller-` (seed pattern). */
export function branchKeyFor(storeKey: string, slug: string): string {
  return `mau-br-${storeKey.replace(/^mau-reseller-/, '')}-${slug}`;
}

/** The slug of a branch name for a new key. */
export function slugOf(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'branch'
  );
}

// ---- branch stock and price ----

export const STOCK_MAX = 100_000;

export const stockInput = z
  .object({
    storeKey: STORE_KEY,
    availableQuantity: z.number().int('Stock must be a whole number').min(0, 'Stock cannot be negative').max(STOCK_MAX, `Stock is at most ${STOCK_MAX}`).optional(),
    /** Branch price in cents; `null` clears it so the store price applies. */
    priceCent: z.number().int('Price in cents must be a whole number').positive('Price must be greater than 0').nullable().optional(),
  })
  .strict()
  .refine((v) => v.availableQuantity !== undefined || v.priceCent !== undefined, { message: 'Nothing to change' });
export type StockInput = z.infer<typeof stockInput>;

export const geocodeInput = z.object({ storeKey: STORE_KEY, address: z.string().trim().min(3, 'Enter an address').max(200) }).strict();
