import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));

import { handle } from '@/lib/api';

const ok = handle('/api/test', async () => Response.json({ ok: true }));

describe('handle applies the request guard', () => {
  it('foreign origin is refused with the stable error shape', async () => {
    const res = await ok(
      new Request('http://localhost:3000/api/x', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: 'forbidden_origin', message: 'The request origin is not allowed' } });
  });
  it('form body is 415 and a json body goes through', async () => {
    const ctx = { params: Promise.resolve({}) };
    const bad = await ok(new Request('http://localhost:3000/api/x', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=1' }), ctx);
    expect(bad.status).toBe(415);
    const good = await ok(
      new Request('http://localhost:3000/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
      ctx,
    );
    expect(good.status).toBe(200);
  });
});
