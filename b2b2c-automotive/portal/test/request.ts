/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** A Request for calling a Route Handler directly: `await POST(makeRequest('/api/x', { method: 'POST', json: {...} }))`. */
export function makeRequest(
  url: string,
  init: Omit<RequestInit, 'body'> & { json?: unknown; cookie?: string } = {},
): Request {
  const { json, cookie, headers, ...rest } = init;
  const h = new Headers(headers);
  if (json !== undefined) h.set('content-type', 'application/json');
  if (cookie) h.set('cookie', cookie);
  return new Request(new URL(url, 'http://localhost:3000'), {
    ...rest,
    headers: h,
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
}
