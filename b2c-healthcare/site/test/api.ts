import { expect } from 'vitest';
import { makeRequest } from './request';

type Handler = (request: Request) => Promise<Response> | Response;

/**
 * Asserts the handler answers 401 `{ error }` for a request without a signed-in customer and
 * that none of the given commercetools mocks was called. The test must mock `@/lib/session`
 * so `getSession()` resolves to `{}`.
 */
export async function expectUnauthenticated(
  handler: Handler,
  ctMocks: ReadonlyArray<{ mock: { calls: unknown[] } }> = [],
  request: Request = makeRequest('/api/test'),
): Promise<void> {
  const response = await handler(request);
  expect(response.status).toBe(401);
  const body = (await response.json()) as { error?: unknown };
  expect(typeof body.error).toBe('string');
  for (const m of ctMocks) expect(m.mock.calls).toHaveLength(0);
}

/**
 * Asserts the handler turns a thrown commercetools-style error into a non-2xx `{ error }` that
 * contains none of `leaks` (raw message, request body, credentials). The test arranges for the
 * mocked `lib/ct` function to reject with an error that contains each `leaks` string.
 */
export async function expectSanitizedError(
  handler: Handler,
  leaks: string[],
  request: Request = makeRequest('/api/test'),
): Promise<void> {
  const response = await handler(request);
  expect(response.status).toBeGreaterThanOrEqual(400);
  const text = await response.text();
  const body = JSON.parse(text) as Record<string, unknown>;
  expect(Object.keys(body)).toEqual(['error']);
  expect(typeof body.error).toBe('string');
  for (const leak of leaks) expect(text).not.toContain(leak);
}
