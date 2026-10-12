// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Theme read: GET {origin}/service/{storeKey}/configuration/theme (no token). Contentools itself falls back to the
// `default` namespace for a store without a theme. The value is returned UNPARSED: parseTheme in lib/theme/adapter.ts is
// the single sanitising entry point and app/layout.tsx is the only caller.
//
// Freshness is owned by an in-memory TTL cache (per server instance, shared by all visitors; a theme is public data):
//   fresh entry -> served; expired and Contentools answers -> replaced; expired and Contentools fails -> last good value,
//   else null (the caller then uses the built-in default theme). Failures are never cached.
import 'server-only';
import { cache } from 'react';
import { createTtlCache } from '@/lib/ttl-cache';
import { CONTENTOOLS_ORIGIN } from './origin';
import { getProjectKey } from './project-key';

export const THEME_TTL_SECONDS = 60;
export const DEFAULT_NAMESPACE = 'default';
const KEY_PATTERN = /^[A-Za-z0-9_-]{2,256}$/;
const TIMEOUT_MS = 2000;

const themeCache = createTtlCache<unknown>({ ttlMs: THEME_TTL_SECONDS * 1000, negativeTtlMs: THEME_TTL_SECONDS * 1000 });

class ThemeReadError extends Error {}

async function fetchTheme(key: string): Promise<unknown | null> {
  const response = await fetch(`${CONTENTOOLS_ORIGIN}/service/${encodeURIComponent(key)}/configuration/theme`, {
    headers: { 'x-project-key': getProjectKey() },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new ThemeReadError(`theme read answered ${response.status}`);
  const body: unknown = await response.json();
  if (body === null) return null;
  if (typeof body !== 'object' || Array.isArray(body)) throw new ThemeReadError('theme body is not an object');
  return body;
}

async function readTheme(storeKey: string | null | undefined): Promise<unknown | null> {
  const key = typeof storeKey === 'string' && KEY_PATTERN.test(storeKey) ? storeKey : DEFAULT_NAMESPACE;
  const fresh = themeCache.get(key);
  if (fresh) return fresh.value;
  try {
    const value = await fetchTheme(key);
    themeCache.set(key, value);
    return value;
  } catch {
    return themeCache.getStale(key)?.value ?? null;
  }
}

export const getStoreTheme: (storeKey: string | null | undefined) => Promise<unknown | null> = cache(readTheme);
