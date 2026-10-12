// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { expect } from 'vitest';
import { makeRequest } from '@/test/request';

type Handler = (request: Request) => Promise<Response>;

/** The handler answers 401 `{ error: 'Not signed in' }` for a request without a session. */
export async function expectUnauthenticated(handler: Handler, request: Request = makeRequest('/api/test')): Promise<void> {
  const res = await handler(request);
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: 'Not signed in' });
}

/** A handler that throws a commercetools-like error answers `{ error: 'Something went wrong' }` and leaks nothing. */
export async function expectSanitizedError(wrap: (fn: Handler) => Handler): Promise<void> {
  const throwing = wrap(async () => {
    throw { statusCode: 500, message: 'secret-token-abc' };
  });
  const res = await throwing(makeRequest('/api/test'));
  const text = await res.text();
  expect(res.status).toBe(500);
  expect(text).toBe('{"error":"Something went wrong"}');
  expect(text).not.toContain('secret-token-abc');
}
