import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ value: {} as Record<string, string> }));
vi.mock('@/lib/session', () => ({ getSession: async () => session.value }));
vi.mock('next/navigation', () => ({
  unstable_rethrow: (e: unknown) => {
    if (typeof e === 'object' && e !== null && String((e as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw e;
  },
}));

import { AppError, errorResponse, toAppError } from '@/lib/errors';
import { handle, requireCustomer } from '@/lib/api';

let logSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  session.value = {};
});
afterEach(() => vi.restoreAllMocks());

const body = async (r: Response) => ({ status: r.status, json: await r.json() });

describe('errors', () => {
  it('commercetools 5xx: a 503 becomes upstream_unavailable with status 503', async () => {
    const r = await body(errorResponse({ statusCode: 503, message: 'secret detail' }, '/api/x'));
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe('upstream_unavailable');
  });

  it('A network failure becomes upstream_unavailable', () => {
    const e = toAppError(new Error('fetch failed'));
    expect([e.code, e.status]).toEqual(['upstream_unavailable', 503]);
  });

  it('Error body is exactly code and message with no stack and no commercetools text', async () => {
    const err = Object.assign(new Error('Project foo ct-secret-detail'), {
      statusCode: 400, body: { message: 'ct-secret-detail' }, stack: 'STACKTRACE',
    });
    const r = await body(errorResponse(err, '/api/x'));
    expect(Object.keys(r.json)).toEqual(['error']);
    expect(Object.keys(r.json.error).sort()).toEqual(['code', 'message']);
    expect(JSON.stringify(r.json)).not.toMatch(/ct-secret-detail|STACKTRACE|Project foo/);
  });

  it('Correlation id is logged and not returned', async () => {
    const e = { statusCode: 503, headers: { 'x-correlation-id': 'corr-123' }, message: 'x' };
    const r = await body(errorResponse(e, '/api/cart'));
    expect(JSON.stringify(r.json)).not.toContain('corr-123');
    const line = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(line).toEqual({
      route: '/api/cart', code: 'upstream_unavailable', status: 503,
      correlationId: 'corr-123', upstreamStatus: 503,
    });
  });

  it('reads the correlation id from the original request when the response has none', () => {
    const e = toAppError({ statusCode: 500, originalRequest: { headers: { 'X-Correlation-ID': 'req-9' } } });
    expect(e.correlationId).toBe('req-9');
  });

  it('409 maps to conflict, 404 to not_found, 429 to rate_limited', () => {
    expect(toAppError({ statusCode: 409 })).toMatchObject({ code: 'conflict', status: 409 });
    expect(toAppError({ statusCode: 404 })).toMatchObject({ code: 'not_found', status: 404 });
    expect(toAppError({ statusCode: 429 })).toMatchObject({ code: 'rate_limited', status: 429 });
    expect(toAppError({ statusCode: 400 })).toMatchObject({ code: 'validation_failed', status: 400 });
  });

  it('commercetools 401 becomes internal_error 500', () => {
    expect(toAppError({ statusCode: 401 })).toMatchObject({ code: 'internal_error', status: 500 });
    expect(toAppError({ statusCode: 403 })).toMatchObject({ code: 'internal_error', status: 500 });
  });

  it('an AppError is returned as itself', () => {
    const e = new AppError('forbidden', 403);
    expect(toAppError(e)).toBe(e);
  });
});

describe('handle and requireCustomer', () => {
  it('Unauthenticated account call: requireCustomer yields 401 with no data and no reason', async () => {
    const route = handle('/api/orders', async () => {
      await requireCustomer();
      return Response.json({ orders: [1] });
    });
    const r = await body(await route(new Request('http://x/api/orders'), { params: Promise.resolve({}) }));
    expect(r).toEqual({ status: 401, json: { error: { code: 'unauthorized', message: 'Sign in required' } } });
  });

  it('requireCustomer returns the session with a customerId', async () => {
    session.value = { customerId: 'u1', cartId: 'c1' };
    expect(await requireCustomer()).toMatchObject({ customerId: 'u1', cartId: 'c1' });
  });

  it('handle returns 500 internal_error for an unknown throw', async () => {
    const route = handle('/api/x', async () => {
      throw new Error('boom');
    });
    const r = await body(await route(new Request('http://x'), { params: Promise.resolve({}) }));
    expect(r.status).toBe(500);
    expect(r.json.error.code).toBe('internal_error');
  });

  it('redirect inside a handler is not swallowed', async () => {
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' });
    const route = handle('/api/x', async () => {
      throw redirectError;
    });
    await expect(route(new Request('http://x'), { params: Promise.resolve({}) })).rejects.toBe(redirectError);
  });
});
