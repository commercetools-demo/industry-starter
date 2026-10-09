// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createLimiter, createMemoryStore, limitKey, VersionConflict, type RateLimitStore } from './rate-limit';

const opts = { limit: 2, windowSec: 60 };
describe('malva-client-portal › Abuse (durable limiter)', () => {
  it('allows up to the limit, then refuses with a Retry-After, and recovers when the window passes', async () => {
    let t = 0;
    const limiter = createLimiter(createMemoryStore(), { now: () => t });
    expect((await limiter.hit('k', opts)).allowed).toBe(true);
    expect((await limiter.hit('k', opts)).allowed).toBe(true);
    const third = await limiter.hit('k', opts);
    expect(third).toEqual({ allowed: false, retryAfterSec: 60 });
    t = 30_000;
    expect((await limiter.hit('k', opts)).retryAfterSec).toBe(30);
    t = 61_000;
    expect((await limiter.hit('k', opts)).allowed).toBe(true);
  });
  it('keys are independent', async () => {
    const limiter = createLimiter(createMemoryStore(), { now: () => 0 });
    await limiter.hit('a', opts); await limiter.hit('a', opts); await limiter.hit('a', opts);
    expect((await limiter.hit('b', opts)).allowed).toBe(true);
  });
  it('retries after a version conflict (two instances racing)', async () => {
    const base = createMemoryStore();
    let conflicts = 1;
    const racing: RateLimitStore = { read: base.read, write: async (k, h, v) => { if (conflicts-- > 0) { await base.write(k, [1], v); throw new VersionConflict(); } return base.write(k, h, v); } };
    const r = await createLimiter(racing, { now: () => 5 }).hit('k', opts);
    expect(r.allowed).toBe(true);
    expect(base.data.get('k')!.hits.length).toBe(2);
  });
  it('fails open, with a log line, when the store is down', async () => {
    const log = vi.fn();
    const down: RateLimitStore = { read: async () => null, write: async () => { throw new Error('boom'); } };
    expect(await createLimiter(down, { log }).hit('k', opts)).toEqual({ allowed: true, retryAfterSec: 0 });
    expect(log).toHaveBeenCalled();
  });
  it('keys never contain the address', () => {
    const key = limitKey('register', '203.0.113.7');
    expect(key).toMatch(/^register\.[0-9a-f]{40}$/);
    expect(key).not.toContain('203');
  });
});
