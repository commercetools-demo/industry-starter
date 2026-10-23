import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));

import { resetRateLimits } from '@/lib/rate-limit';
import { limitClient } from './limit';

const req = (ip: string) => new Request('http://localhost:3000/api/x', { method: 'POST', headers: { 'x-forwarded-for': ip } });

describe('limitClient', () => {
  beforeEach(() => resetRateLimits());

  it('the request over the limit is 429 with a Retry-After header', async () => {
    const opts = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i += 1) expect(limitClient(req('1.1.1.1'), 'r', opts)).toBeNull();
    const refused = limitClient(req('1.1.1.1'), 'r', opts);
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await refused?.json()).error.code).toBe('rate_limited');
  });

  it('another client and another route have their own window', () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(limitClient(req('1.1.1.1'), 'r', opts)).toBeNull();
    expect(limitClient(req('2.2.2.2'), 'r', opts)).toBeNull();
    expect(limitClient(req('1.1.1.1'), 'other', opts)).toBeNull();
  });
});
