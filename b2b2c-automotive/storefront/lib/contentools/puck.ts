// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Published Puck page read for a Server Component. Plain fetch on purpose: the Puck packages create React context at
// module load ("createContext is not a function" in a Server Component), so only a type is imported from them.
import 'server-only';
import type { PuckData } from '@commercetools-demo/puck-types';
import { cache } from 'react';
import { CONTENTOOLS_ORIGIN } from './origin';
import { getProjectKey } from './project-key';

export const HOME_SLUG = '/home';
export const STORE_KEY_PATTERN = /^[A-Za-z0-9_-]{2,256}$/;
const SLUG_PATTERN = /^\/[a-z0-9][a-z0-9/_-]*$/i;
const TIMEOUT_MS = 2000;

async function readPublishedPage(storeKey: string, slug: string): Promise<PuckData | null> {
  // The slug goes into a Contentools query string, so nothing with a quote, backslash or whitespace gets through.
  if (!STORE_KEY_PATTERN.test(storeKey) || !SLUG_PATTERN.test(slug)) return null;
  try {
    const response = await fetch(`${CONTENTOOLS_ORIGIN}/service/${encodeURIComponent(storeKey)}/published/puck-pages/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-project-key': getProjectKey() },
      body: JSON.stringify({ query: `slug = "${slug}"` }),
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null; // 404 is "no published page"
    const body: unknown = await response.json();
    const puckData = (body as { puckData?: { content?: unknown } } | null)?.puckData;
    if (!puckData || !Array.isArray(puckData.content) || puckData.content.length === 0) return null;
    return puckData as PuckData;
  } catch {
    return null;
  }
}

export const getPublishedPage: (storeKey: string, slug?: string) => Promise<PuckData | null> = cache((storeKey: string, slug: string = HOME_SLUG) => readPublishedPage(storeKey, slug));
