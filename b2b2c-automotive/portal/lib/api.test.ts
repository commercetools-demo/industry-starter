// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { makeRequest } from '@/test/request';
import { ApiError, handle, parseJson, requireBusinessUnit, requireCustomer, requireStore } from './api';
import { AppError } from './errors';

const ct = vi.hoisted(() => ({ getThing: vi.fn() }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  ct.getThing.mockReset();
});

const failWith = (error: unknown) =>
  handle(async (): Promise<Response> => {
    throw error;
  });

describe('BFF boundary: failure shape', () => {
  it('Failure shape', async () => {
    const res = await failWith(new ApiError(404, 'whatever internal text'))(makeRequest('/api/x'));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
  it('A 400 ApiError keeps its own validation text', async () => {
    const res = await failWith(new ApiError(400, 'Name is required'))(makeRequest('/api/x'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Name is required' });
  });
  it('A coded error keeps its deliberate message and adds the code', async () => {
    const res = await failWith(new ApiError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS'))(makeRequest('/api/x'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Email or password is incorrect.', code: 'INVALID_CREDENTIALS' });
    const validation = await failWith(new ApiError(400, 'Fill in every field to continue.', 'FIELDS_REQUIRED'))(makeRequest('/api/x'));
    expect(await validation.json()).toEqual({ error: 'Fill in every field to continue.', code: 'FIELDS_REQUIRED' });
  });
  it('A coded error above 499 is still sanitized', async () => {
    const res = await failWith(new ApiError(503, 'internal detail', 'X'))(makeRequest('/api/x'));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"Something went wrong"}');
  });
  it('A 403 shows the insufficient permissions text', async () => {
    const res = await failWith(new ApiError(403, 'x'))(makeRequest('/api/x'));
    expect(await res.json()).toEqual({ error: 'Insufficient permissions to perform this task' });
  });
  it('A plain AppError (lib/errors) is mapped as well', async () => {
    const res = await failWith(new AppError(401, 'x'))(makeRequest('/api/x'));
    expect(res.status).toBe(401);
  });
  it('SDK 403 maps to the insufficient permissions text', async () => {
    const res = await failWith({ statusCode: 403, message: 'Associate has no rights, Needs CreateMyCarts' })(makeRequest('/api/x'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Insufficient permissions to perform this task' });
  });
  it('SDK 404 maps to Not found', async () => {
    const res = await failWith({ statusCode: 404, message: 'The Cart with ID abc was not found' })(makeRequest('/api/x'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
  it('SDK 409 maps to retry message', async () => {
    const res = await failWith({ statusCode: 409, message: 'version mismatch' })(makeRequest('/api/x'));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Conflict, please retry' });
  });
  it('SDK 400 and 401 are the app, not the user: 500 without details', async () => {
    for (const statusCode of [400, 401]) {
      const res = await failWith({ statusCode, message: 'invalid_client secret-xyz' })(makeRequest('/api/x'));
      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain('secret-xyz');
    }
  });
  it('Unknown error maps to 500 without details', async () => {
    const res = await failWith(new Error('db password is hunter2'))(makeRequest('/api/x'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Something went wrong' });
  });
  it('Sanitized error', async () => {
    await expectSanitizedError();
  });
  it('The log line has the status and class only', async () => {
    await failWith(Object.assign(new Error('token-abc'), { statusCode: 500 }))(makeRequest('/api/x'));
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain('status=500');
    expect(logged).not.toContain('token-abc');
  });
  it('Next control-flow errors pass through', async () => {
    const redirectLike = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' });
    await expect(failWith(redirectLike)(makeRequest('/api/x'))).rejects.toBe(redirectLike);
  });
  it('Responses are no-store unless the handler chose a policy', async () => {
    const plain = await handle(async () => Response.json({ ok: true }))(makeRequest('/api/x'));
    expect(plain.headers.get('cache-control')).toBe('no-store');
    const own = await handle(async () => Response.json({}, { headers: { 'Cache-Control': 'private, max-age=60' } }))(makeRequest('/api/x'));
    expect(own.headers.get('cache-control')).toBe('private, max-age=60');
  });
  it('Handler arguments and result pass through', async () => {
    const res = await handle(async (request: Request, ctx: { id: string }) => Response.json({ url: new URL(request.url).pathname, id: ctx.id }))(makeRequest('/api/y'), { id: '7' });
    expect(await res.json()).toEqual({ url: '/api/y', id: '7' });
  });
});

describe('BFF boundary: Route Handler boundary', () => {
  const route = handle(async () => {
    const session = {} as Parameters<typeof requireCustomer>[0];
    requireCustomer(session);
    return Response.json(await ct.getThing());
  });

  it('Unauthenticated access is 401 before any commercetools call', async () => {
    await expectUnauthenticated(route);
    expect(ct.getThing).not.toHaveBeenCalled();
  });
  it('Customer present passes', () => {
    expect(() => requireCustomer({ customerId: 'c1' })).not.toThrow();
  });
  it('Business unit required', async () => {
    expect(() => requireBusinessUnit({ customerId: 'c1' })).toThrow(expect.objectContaining({ status: 400, message: 'No active business unit' }));
    expect(() => requireBusinessUnit({ customerId: 'c1', pending: true, businessUnitKey: 'x' })).toThrow('No active business unit');
    expect(() => requireBusinessUnit({})).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => requireBusinessUnit({ customerId: 'c1', businessUnitKey: 'bu' })).not.toThrow();
    const res = await failWith(new ApiError(400, 'No active business unit'))(makeRequest('/api/x'));
    expect(await res.json()).toEqual({ error: 'No active business unit' });
  });
  it('Store required', () => {
    const base = { customerId: 'c1', businessUnitKey: 'bu' };
    expect(() => requireStore(base)).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => requireStore({ ...base, storeKey: 's', distributionChannelId: 'd', supplyChannelId: 'c', productSelectionId: 'p' })).not.toThrow();
  });
});

describe('BFF boundary: parseJson', () => {
  const schema = z.object({ name: z.string().min(1, 'Name is required'), qty: z.number().int().positive() });
  const post = (body: BodyInit | null) => new Request('http://localhost:3001/api/x', { method: 'POST', body, headers: { 'content-type': 'application/json' } });

  it('Valid body is parsed', async () => {
    expect(await parseJson(post('{"name":"a","qty":2}'), schema)).toEqual({ name: 'a', qty: 2 });
  });
  it('Invalid JSON body is 400', async () => {
    await expect(parseJson(post('{nope'), schema)).rejects.toMatchObject({ status: 400, message: 'Invalid JSON body' });
    await expect(parseJson(post(null), schema)).rejects.toMatchObject({ status: 400 });
  });
  it('Zod issue becomes the message', async () => {
    await expect(parseJson(post('{"name":"","qty":1}'), schema)).rejects.toMatchObject({ status: 400, message: 'Name is required' });
  });
  it('Through handle the body is the safe shape', async () => {
    const res = await handle((request: Request) => parseJson(request, schema).then((b) => Response.json(b)))(post('{"name":"a"}'));
    expect(res.status).toBe(400);
    expect(Object.keys(await res.json())).toEqual(['error']);
  });
});
