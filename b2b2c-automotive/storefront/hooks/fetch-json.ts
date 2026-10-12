// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
/** Shared SWR fetcher and mutation helper for the BFF routes. Only hooks call it; components never fetch `/api` directly. */
export class HttpError extends Error {
  constructor(public status: number) {
    super(`Request failed with status ${status}`);
    this.name = 'HttpError';
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init });
  if (!res.ok) throw new HttpError(res.status);
  return (await res.json()) as T;
}

export const postJson = <T>(url: string, body: unknown): Promise<T> =>
  fetchJson<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
