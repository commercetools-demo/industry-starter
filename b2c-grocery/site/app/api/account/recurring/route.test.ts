// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summary } from '@/test/recurring';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/config/features', async (orig) => ({ ...(await orig<typeof import('@/lib/config/features')>()), subscriptionsEnabled: vi.fn(() => true) }));
vi.mock('@/lib/ct/recurring-orders', async (orig) => ({ ...(await orig<typeof import('@/lib/ct/recurring-orders')>()), getRecurringOrders: vi.fn() }));
vi.mock('@/lib/ct/recurrence-policies', () => ({ getRecurrencePolicies: vi.fn() }));

import { GET } from './route';
import { subscriptionsEnabled } from '@/lib/config/features';
import { getRecurrencePolicies } from '@/lib/ct/recurrence-policies';
import { getRecurringOrders } from '@/lib/ct/recurring-orders';
import { getMarket, getSession } from '@/lib/session';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(subscriptionsEnabled).mockReturnValue(true);
  vi.mocked(getSession).mockResolvedValue({ customerId: 'cu-1' });
  vi.mocked(getMarket).mockResolvedValue({ country: 'DE', currency: 'EUR', locale: 'de-DE' });
  vi.mocked(getRecurringOrders).mockResolvedValue([summary()]);
  vi.mocked(getRecurrencePolicies).mockResolvedValue([{ key: 'weekly', id: 'p1', name: 'Jede Woche', schedule: null }]);
});

describe('GET /api/account/recurring', () => {
  it('Anonymous: 401, private, nothing is read', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getRecurringOrders).not.toHaveBeenCalled();
  });

  it('Active recurring order: the list and the switchable cadences in the market locale, private', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getRecurringOrders).toHaveBeenCalledWith('cu-1', 'de-DE');
    expect(getRecurrencePolicies).toHaveBeenCalledWith('de-DE');
    expect(await res.json()).toEqual({ recurringOrders: [summary()], policies: [{ key: 'weekly', name: 'Jede Woche' }] });
  });

  it('flag off: 404 before the session or commercetools are touched', async () => {
    vi.mocked(subscriptionsEnabled).mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(getSession).not.toHaveBeenCalled();
    expect(getRecurringOrders).not.toHaveBeenCalled();
  });

  it('failure: 500 RECURRING_ERROR without details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getRecurringOrders).mockRejectedValue(new Error('boom'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'RECURRING_ERROR' });
  });
});
