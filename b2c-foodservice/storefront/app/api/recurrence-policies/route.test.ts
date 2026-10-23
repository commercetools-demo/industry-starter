// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ policies: vi.fn() }));
vi.mock('@/lib/ct/product-detail', () => ({ getRecurrencePolicies: h.policies }));

import { GET } from './route';

const get = (qs = '') => GET(new Request(`http://x/api/recurrence-policies${qs}`), { params: Promise.resolve({}) });

beforeEach(() => {
  h.policies.mockReset();
  h.policies.mockResolvedValue([{ id: 'r1', key: 'mcf-every-month', name: 'Every month', schedule: { unit: 'Months', value: 1 } }]);
});

describe('GET /api/recurrence-policies', () => {
  it('recurrence policies endpoint is public cached', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(await res.json()).toEqual({ policies: [{ id: 'r1', key: 'mcf-every-month', name: 'Every month', schedule: { unit: 'Months', value: 1 } }] });
    expect(h.policies).toHaveBeenCalledWith('en-US');
  });

  it('the locale only picks the name; an unknown locale is refused', async () => {
    await get('?locale=en-CA');
    expect(h.policies).toHaveBeenCalledWith('en-CA');
    expect((await get('?locale=de-DE')).status).toBe(400);
  });

  it('a failed read is an upstream error, not a leak', async () => {
    h.policies.mockRejectedValue(Object.assign(new Error('secret detail'), { statusCode: 503 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await get();
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret detail');
  });
});
