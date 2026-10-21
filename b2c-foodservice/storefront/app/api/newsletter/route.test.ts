// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/lib/rate-limit';
import { POST } from './route';

const post = (body: unknown) =>
  POST(new Request('http://x/api/newsletter', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), {
    params: Promise.resolve({}),
  });

afterEach(() => vi.restoreAllMocks());

describe('POST /api/newsletter', () => {
  it('422 invalid_email', async () => {
    for (const body of [{ email: 'nope' }, { email: '' }, {}, { email: 5 }, 'not json', { email: `${'a'.repeat(250)}@x.io` }]) {
      const res = await post(body);
      expect(res.status).toBe(422);
      expect((await res.json()).error.code).toBe('validation_failed');
    }
  });

  it('202 and the address is not logged', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    const res = await post({ email: ' qa@example.com ' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('qa@example.com');
  });

  it('newsletter route uses the shared limiter: the eleventh signup in an hour is 429 with Retry-After', async () => {
    resetRateLimits();
    for (let i = 0; i < 10; i += 1) expect((await post({ email: 'qa@example.com' })).status).toBe(202);
    const res = await post({ email: 'qa@example.com' });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).not.toBeNull();
    resetRateLimits();
  });
});
