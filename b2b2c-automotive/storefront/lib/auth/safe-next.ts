// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The address a shopper returns to after signing in (`?next=`): a path inside the store (no locale, no store key: `/cart`, `/account/orders`), never another origin. Pure, safe in client code.

/**
 * `value` when it is a plain path of this site (starts with one `/`, no scheme, no `//`, no backslash, no control characters), else
 * `fallback`. The sign-in form prefixes the store key, and the i18n router adds the locale.
 */
export function safeNext(value: string | null | undefined, fallback = '/account'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    // A path that resolves to another origin (for example `/\evil.example`, or encoded tricks) is refused.
    if (new URL(value, 'https://shop.invalid').origin !== 'https://shop.invalid') return fallback;
  } catch {
    return fallback;
  }
  return value;
}
