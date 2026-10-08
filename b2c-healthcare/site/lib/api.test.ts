// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

import { ApiError, handle, requireCustomer } from './api';

const getOrders = vi.fn();

// An example patient-data Route Handler in the documented shape.
async function GET(): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    return getOrders(customerId);
  });
}

describe('storefront-bff-and-session: Route Handler boundary', () => {
  beforeEach(() => {
    getSession.mockReset();
    getOrders.mockReset();
  });

  it('Unauthenticated access to patient data: 401 { error } and no commercetools call', async () => {
    getSession.mockResolvedValue({ locale: 'en-US' });
    await expectUnauthenticated(GET, [getOrders]);
  });

  it('happy path: signed-in session calls one function and returns JSON', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    getOrders.mockResolvedValue({ results: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
    expect(getOrders).toHaveBeenCalledExactlyOnceWith('c1');
  });

  it('Failure shape: an SDK-style error never leaks its message, body or credentials', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    getOrders.mockRejectedValue(
      Object.assign(new Error('invalid_client secret=abc123 body={"email":"pat@example.test"}'), {
        statusCode: 401,
        body: { message: 'Authorization: Bearer tok-999' },
        originalRequest: { headers: { Authorization: 'Bearer tok-999' } },
      }),
    );
    await expectSanitizedError(GET, ['abc123', 'pat@example.test', 'tok-999', 'invalid_client']);
  });

  it('Failure shape: 404 and 409 keep their status with a safe message; unknown errors are 500', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    getOrders.mockRejectedValueOnce({ statusCode: 404, message: 'raw' });
    expect((await GET()).status).toBe(404);
    getOrders.mockRejectedValueOnce({ statusCode: 409, message: 'raw' });
    expect((await GET()).status).toBe(409);
    getOrders.mockRejectedValueOnce(new Error('boom with secret'));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('secret');
  });

  it('Failure shape: a 5xx from commercetools stays a safe error', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    getOrders.mockRejectedValue({ statusCode: 503, message: 'upstream detail' });
    await expectSanitizedError(GET, ['upstream detail']);
  });

  it('ApiError carries its own safe status and message; Response results pass through', async () => {
    const response = await handle(() => {
      throw new ApiError(422, 'Choose a time slot.');
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'Choose a time slot.' });
    const passthrough = await handle(() => new Response(null, { status: 204 }));
    expect(passthrough.status).toBe(204);
  });

  it('No SDK in handlers: no file under app/api references apiRoot or the SDK', () => {
    const dir = resolve(import.meta.dirname, '../app/api');
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) files.push(p);
      }
    };
    walk(dir);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/apiRoot|getApiRoot|@commercetools\/(platform-sdk|ts-client)|lib\/ct\/client/);
    }
  });
});
