// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Theme loader contract for emails and invoices (workstreams P and W import these; U-06). A plain read of
// `GET {origin}/service/{storeKey}/configuration/theme` with the project key and no token. Contentools itself falls back to the
// `default` namespace for a store without a theme; a 404 or any failure gives `null`. No email is ever sent (Q-P01): the
// template previews only use the colour.
import 'server-only';
import { cache } from 'react';
import type { ThemeTokens } from '@commercetools-demo/puck-types';
import { MALVA_DEFAULT_PRIMARY, parseColour, toHex } from './colour';
import { CONTENTOOLS_ORIGIN } from './origin';
import { getProjectKey } from './project-key';

export type { ThemeTokens };

const KEY_PATTERN = /^[A-Za-z0-9_-]{2,256}$/;
const DEFAULT_NAMESPACE = 'default';
const TIMEOUT_MS = 2000;

async function fetchTheme(key: string): Promise<ThemeTokens | null> {
  try {
    const response = await fetch(`${CONTENTOOLS_ORIGIN}/service/${encodeURIComponent(key)}/configuration/theme`, {
      headers: { 'x-project-key': getProjectKey() },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as ThemeTokens) : null;
  } catch {
    return null;
  }
}

/** The store's theme, else the `default` namespace's, else `null`. The value is untrusted: read colours with `themePrimaryColour`. */
export const getStoreTheme: (storeKey: string) => Promise<ThemeTokens | null> = cache(async (storeKey: string) => {
  if (KEY_PATTERN.test(storeKey)) {
    const own = await fetchTheme(storeKey);
    if (own) return own;
  }
  return fetchTheme(DEFAULT_NAMESPACE);
});

/** The theme's primary colour as a sanitised `#rrggbb`, or the Malva default when absent or not a plain colour. */
export function themePrimaryColour(theme: ThemeTokens | null): string {
  const rgb = parseColour(theme?.colorPrimary);
  return rgb ? toHex(rgb) : MALVA_DEFAULT_PRIMARY;
}
