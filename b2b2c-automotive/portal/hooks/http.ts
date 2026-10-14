/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// The only place the browser talks to the portal's own Route Handlers (hook-only fetching, lint rule).
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** The safe `error` text of a failure body, when there is one. */
  error?: string;
  code?: string;
}

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // an empty or non-JSON body
  }
  const body = (data ?? {}) as { error?: unknown; code?: unknown };
  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? (data as T) : null,
    error: typeof body.error === 'string' ? body.error : undefined,
    code: typeof body.code === 'string' ? body.code : undefined,
  };
}

export async function postJson<T = unknown>(url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    return await parse<T>(response);
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function getJson<T = unknown>(url: string): Promise<ApiResult<T>> {
  try {
    return await parse<T>(await fetch(url, { credentials: 'same-origin', cache: 'no-store' }));
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/** SWR fetcher: throws on failure so SWR reports `error`. */
export async function swrFetcher<T>(url: string): Promise<T> {
  const result = await getJson<T>(url);
  if (!result.ok || result.data === null) throw new Error(`Request failed (${result.status})`);
  return result.data;
}
