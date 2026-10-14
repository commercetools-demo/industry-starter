// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Server-side calls the seller routes make to Contentools with the server-held JWT (workstream U): delete a store's theme,
// upload a logo or favicon, and ask whether the store has a published page. The browser never sees the token or the origin.
import 'server-only';
import { ApiError } from '@/lib/api';
import { getValidContentoolsJwt } from './jwt';
import { CONTENTOOLS_ORIGIN } from './origin';
import { getProjectKey } from './project-key';

const TIMEOUT_MS = 15_000;
const KEY = /^[A-Za-z0-9_-]{2,256}$/;

function storeUrl(storeKey: string, rest: string): string {
  if (!KEY.test(storeKey)) throw new ApiError(400, 'Invalid store');
  return `${CONTENTOOLS_ORIGIN}/service/${storeKey}/${rest}`;
}

async function requireJwt(): Promise<string> {
  const jwt = await getValidContentoolsJwt();
  if (!jwt) throw new ApiError(503, 'contentools_not_connected', 'CONTENTOOLS_NOT_CONNECTED');
  return jwt;
}

/** Reset to Malva default: deletes the store's theme so Contentools serves the `default` namespace. An upstream 404 is success. */
export async function deleteStoreTheme(storeKey: string): Promise<void> {
  const jwt = await requireJwt();
  const response = await fetch(storeUrl(storeKey, 'configuration/theme'), {
    method: 'DELETE',
    headers: { authorization: `Bearer ${jwt}`, 'x-project-key': getProjectKey() },
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.ok || response.status === 404) return;
  throw new Error(`theme delete answered ${response.status}`);
}

export interface UploadInput {
  bytes: ArrayBuffer;
  type: string;
  name: string;
}

/**
 * Uploads one image to the store's Contentools object store (`POST /service/{storeKey}/upload-file`, multipart field `file`).
 * Returns the clean URL (no query string, no fragment: stored values are never signed or sized, JUNIOR-GUIDE rule 9).
 */
export async function uploadStoreFile(storeKey: string, file: UploadInput): Promise<string> {
  const jwt = await requireJwt();
  const form = new FormData();
  form.set('file', new Blob([file.bytes], { type: file.type }), file.name);
  const response = await fetch(storeUrl(storeKey, 'upload-file'), {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'x-project-key': getProjectKey() },
    body: form,
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`upload answered ${response.status}`);
  const body = (await response.json()) as { url?: unknown };
  if (typeof body.url !== 'string') throw new Error('upload answered without a url');
  const url = new URL(body.url);
  url.search = '';
  url.hash = '';
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('upload answered with a bad url');
  return url.toString();
}

/** True when the store has a published page with this slug (the link-in-bio notice). Reads need no token. */
export async function hasPublishedPage(storeKey: string, slug: string): Promise<boolean> {
  try {
    const response = await fetch(storeUrl(storeKey, 'published/puck-pages/query'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-project-key': getProjectKey() },
      body: JSON.stringify({ query: `slug = "${slug.replace(/["\\]/g, '')}"` }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
