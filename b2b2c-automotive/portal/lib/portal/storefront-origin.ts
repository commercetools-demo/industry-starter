// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The public address of the shopper storefront and the theme cache lifetime (workstream U decisions 11 and 13). Neither is a
// secret. Call these on the server and pass the values to client components as props.
import { DEFAULT_LOCALE_KEY } from '@/i18n/config';

type Env = Record<string, string | undefined>;

export const DEV_STOREFRONT_ORIGIN = 'http://localhost:3000';
export const DEFAULT_THEME_CACHE_SECONDS = 60;

/** `STOREFRONT_ORIGIN` without a trailing slash; the development default outside production. Empty in production when unset. */
export function storefrontOrigin(env: Env = process.env): string {
  const value = env.STOREFRONT_ORIGIN?.trim().replace(/\/+$/, '');
  if (value) return value;
  return env.NODE_ENV === 'production' ? '' : DEV_STOREFRONT_ORIGIN;
}

/** Seconds until a saved theme shows (must equal the storefront's THEME_TTL_SECONDS); 60 when unset or invalid. */
export function themeCacheSeconds(env: Env = process.env): number {
  const n = Number(env.STOREFRONT_THEME_CACHE_SECONDS);
  return Number.isInteger(n) && n > 0 && n <= 3600 ? n : DEFAULT_THEME_CACHE_SECONDS;
}

/** The read-only storefront address of a store: `<origin>/<default locale>/<store key>`. */
export function storefrontAddress(origin: string, storeKey: string, locale: string = DEFAULT_LOCALE_KEY): string {
  return `${origin}/${locale}/${storeKey}`;
}

/** Host of the origin for the save toast ("shop.example.com"); the origin itself when it does not parse. */
export function storefrontHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}
