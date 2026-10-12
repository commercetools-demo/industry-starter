// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// PUT, DELETE and multipart calls of the Store & channels, Company and Account screens (workstream U). `hooks/http.ts` has the
// GET and POST helpers; the browser talks to the portal's own Route Handlers only, and only from hooks (lint rule).
import type { ApiResult } from './http';

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

export async function sendJson<T = unknown>(method: 'PUT' | 'DELETE' | 'POST', url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    return await parse<T>(response);
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function postForm<T = unknown>(url: string, form: FormData): Promise<ApiResult<T>> {
  try {
    return await parse<T>(await fetch(url, { method: 'POST', body: form, credentials: 'same-origin' }));
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/** The text a screen shows for a failed call: the server's safe message, else the fallback. */
export const failureText = (result: ApiResult<unknown>, fallback: string): string => result.error ?? fallback;
