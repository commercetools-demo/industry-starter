// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { makeRequest } from '@/test/request';
import { ApiError, handle, parseJson, requireCustomer } from './api';

afterEach(() => vi.restoreAllMocks());

const fail = (e: unknown) =>
  handle(async () => {
    throw e;
  });

describe('BFF boundary: Route Handler helpers', () => {
  it('Failure shape', async () => {
    const res = await fail(new ApiError(400, 'Bad input'))();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Bad input' });
  });

  it('Success responses pass through untouched', async () => {
    const res = await handle(async () => Response.json({ ok: true }, { status: 201 }))();
    expect(res.status).toBe(201);
  });

  it('Unauthenticated access is 401 before any commercetools call', async () => {
    const ct = vi.fn();
    const handler = handle(async () => {
      requireCustomer({});
      ct();
      return Response.json({});
    });
    await expectUnauthenticated(handler);
    expect(ct).not.toHaveBeenCalled();
  });

  it('A signed in session passes requireCustomer', () => {
    expect(() => requireCustomer({ customerId: 'c1' })).not.toThrow();
  });

  it('SDK 404 maps to Not found', async () => {
    const res = await fail({ statusCode: 404, message: 'ResourceNotFound id=abc' })();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('SDK 409 maps to retry message', async () => {
    const res = await fail({ statusCode: 409, message: 'ConcurrentModification' })();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Conflict, please retry' });
  });

  it('SDK 403 maps to the permission message', async () => {
    const res = await fail({ statusCode: 403, message: 'insufficient_scope manage_x' })();
    expect(await res.json()).toEqual({ error: 'Insufficient permissions to perform this task' });
  });

  it('Unknown error maps to 500 without details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expectSanitizedError((fn) => handle(fn));
    const res = await fail(new Error('db password is hunter2'))();
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('hunter2');
  });

  it('SDK 400 and 500 never leak the SDK message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await fail({ statusCode: 400, message: 'invalid field customerEmail=a@example.com' })();
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('example.com');
  });

  it('The log line holds only status and class', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fail(new Error('secret-token-abc'))();
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-token-abc');
  });
});

describe('BFF boundary: parseJson', () => {
  const schema = z.object({ qty: z.number().int().min(1, 'Quantity must be at least 1') });
  const post = (body: string) => makeRequest('/api/x', { method: 'POST', body, headers: { 'content-type': 'application/json' } });

  it('Valid body is parsed', async () => {
    expect(await parseJson(post('{"qty":2}'), schema)).toEqual({ qty: 2 });
  });
  it('Invalid JSON body is 400', async () => {
    const res = await handle(async (r: Request) => Response.json(await parseJson(r, schema)))(post('{nope'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });
  it('Zod issue becomes the message', async () => {
    const res = await handle(async (r: Request) => Response.json(await parseJson(r, schema)))(post('{"qty":0}'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Quantity must be at least 1' });
  });
});
