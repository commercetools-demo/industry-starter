// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The sign-in return path (`?next=`). Pure, no server-only: the proxy and the sign-in page share it.
import { isAppLocale } from '@/i18n/config';

/** Routes (after the locale segment) that a signed-out visitor may open. */
export const AUTH_ROUTES = ['sign-in', 'register', 'reset', 'pending-approval'] as const;

export function isAuthRoute(firstSegment: string | undefined): boolean {
  return firstSegment !== undefined && (AUTH_ROUTES as readonly string[]).includes(firstSegment);
}

const MAX_LENGTH = 512;

/**
 * Validates a return path from the query string. Returns the locale-less path (with its query) or `undefined`.
 * Accepts only an app-relative path: one leading `/`, never `//`, no backslash, no scheme or control character,
 * not an API route, not an auth route (no sign-in loops). A leading locale segment is removed because the router adds it.
 */
export function sanitizeNext(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return undefined;
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return undefined;
  let url: URL;
  try {
    url = new URL(raw, 'http://placeholder.invalid');
  } catch {
    return undefined;
  }
  if (url.origin !== 'http://placeholder.invalid') return undefined;
  const segments = url.pathname.split('/').filter((s, i) => i > 0 || s !== '');
  if (segments[0] !== undefined && isAppLocale(segments[0])) segments.shift();
  const first = segments[0];
  if (first === 'api' || isAuthRoute(first)) return undefined;
  const path = `/${segments.join('/')}`;
  if (path.startsWith('//')) return undefined;
  return `${path}${url.search}`;
}
