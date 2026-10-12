// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Route Handler test helpers (G-04). Reuse them in every handler test.
import { expect } from 'vitest';
import { handle } from '@/lib/api';
import { makeRequest } from './request';

/** A handler called without a session answers 401 `Not signed in`. `build` makes the request when the default GET is not right. */
export async function expectUnauthenticated(handler: (request: Request) => Promise<Response>, build: () => Request = () => makeRequest('/api/x')): Promise<void> {
  const response = await handler(build());
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Not signed in' });
}

/** A handler that fails with an SDK-shaped error answers `{"error":"Something went wrong"}` and never echoes the message. */
export async function expectSanitizedError(run: (failing: (request: Request) => Promise<Response>) => (request: Request) => Promise<Response> = (h) => h): Promise<void> {
  const failing = handle(async (): Promise<Response> => {
    throw { statusCode: 500, message: 'secret-token-abc' };
  });
  const response = await run(failing)(makeRequest('/api/x'));
  const text = await response.text();
  expect(response.status).toBe(500);
  expect(text).toBe('{"error":"Something went wrong"}');
  expect(text).not.toContain('secret-token-abc');
}
