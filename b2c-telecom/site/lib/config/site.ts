/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** Public origin without trailing slash. `URL` is set by Netlify at build; `SITE_URL` lets the owner force the production domain. */
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const value = env.SITE_URL || env.URL || 'http://localhost:3000';
  return value.replace(/\/+$/, '');
}

export const SITE_URL: string = resolveSiteUrl();
