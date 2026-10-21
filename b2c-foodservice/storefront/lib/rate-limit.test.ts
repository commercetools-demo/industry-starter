import { beforeEach, describe, expect, it } from 'vitest';
import { hashKey, rateLimit, resetRateLimits } from '@/lib/rate-limit';

beforeEach(() => resetRateLimits());

describe('rate limiter', () => {
  it('Login attempts are limited per address and per ip', () => {
    const opts = { limit: 5, windowMs: 600_000 };
    const a = hashKey('1.1.1.1', 'a@example.com');
    const b = hashKey('1.1.1.1', 'b@example.com');
    for (let i = 0; i < 5; i++) expect(rateLimit(a, opts, 1000 + i).allowed).toBe(true);
    const blocked = rateLimit(a, opts, 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(rateLimit(b, opts, 2000).allowed).toBe(true);
    const ipOpts = { limit: 30, windowMs: 600_000 };
    const ip = hashKey('ip', '1.1.1.1');
    for (let i = 0; i < 30; i++) rateLimit(ip, ipOpts, 1000);
    expect(rateLimit(ip, ipOpts, 1001).allowed).toBe(false);
  });

  it('the window slides and the key is hashed', () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit('k', opts, 0).allowed).toBe(true);
    expect(rateLimit('k', opts, 500).allowed).toBe(false);
    expect(rateLimit('k', opts, 1500).allowed).toBe(true);
    expect(hashKey('a@example.com')).not.toContain('example');
  });
});
