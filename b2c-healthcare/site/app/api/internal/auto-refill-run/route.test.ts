// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

const run = vi.hoisted(() => ({ runAutoRefill: vi.fn() }));
vi.mock('@/lib/ct/auto-refill-run', () => run);

import { POST } from './route';

const SECRET = 'a-secret-of-16-chars-or-more';
const post = (headers: Record<string, string> = {}) => POST(makeRequest('/api/internal/auto-refill-run', { method: 'POST', headers }));

beforeEach(() => {
  run.runAutoRefill.mockReset().mockResolvedValue({ checked: { allowed: 2 }, reconciled: { consumed: 1 } });
  vi.stubEnv('AUTO_REFILL_RUN_SECRET', SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe('subscriptions-and-recurring-orders: POST /api/internal/auto-refill-run', () => {
  it('runs with the secret and answers counts, not cached', async () => {
    const r = await post({ 'x-refill-secret': SECRET });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ checked: { allowed: 2 }, reconciled: { consumed: 1 } });
  });

  it('without the header or with a wrong one: 401 with no detail, and nothing runs', async () => {
    for (const headers of [{}, { 'x-refill-secret': 'nope' }, { 'x-refill-secret': `${SECRET}x` }] as Record<string, string>[]) {
      const r = await post(headers);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'Unauthorized.' });
    }
    expect(run.runAutoRefill).not.toHaveBeenCalled();
  });

  it('without a configured (or with a too short) secret the route is disabled, even for a caller that sends an empty header', async () => {
    vi.stubEnv('AUTO_REFILL_RUN_SECRET', '');
    expect((await post({ 'x-refill-secret': '' })).status).toBe(503);
    vi.stubEnv('AUTO_REFILL_RUN_SECRET', 'short');
    expect((await post({ 'x-refill-secret': 'short' })).status).toBe(503);
    expect(run.runAutoRefill).not.toHaveBeenCalled();
  });

  it('a failing run is a 500 without the error text', async () => {
    run.runAutoRefill.mockRejectedValue(new Error('RX-77102 leaked'));
    const r = await post({ 'x-refill-secret': SECRET });
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('RX-77102');
  });
});
