// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cart-api', async (orig) => ({ ...(await orig<typeof import('@/lib/cart-api')>()), getSessionCart: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn(), updateSession: vi.fn() }));
vi.mock('@/lib/slots/days', () => ({ getSlotDays: vi.fn() }));

import { GET } from './route';
import { getSessionCart } from '@/lib/cart-api';
import { getSlotDays } from '@/lib/slots/days';

beforeEach(() => vi.resetAllMocks());

describe('GET /api/slots', () => {
  it('no address: 400 NO_ADDRESS', async () => {
    vi.mocked(getSessionCart).mockResolvedValue({ shippingAddress: undefined } as never);
    vi.mocked(getSlotDays).mockResolvedValue({ ok: false, error: 'NO_ADDRESS' });
    const res = await GET();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'NO_ADDRESS' });
  });

  it('no cart: 400 NO_ADDRESS', async () => {
    vi.mocked(getSessionCart).mockResolvedValue(null);
    vi.mocked(getSlotDays).mockResolvedValue({ ok: false, error: 'NO_ADDRESS' });
    expect((await GET()).status).toBe(400);
    expect(getSlotDays).toHaveBeenCalledWith({ shippingAddress: undefined });
  });

  it('days grouping: passes the cart address and returns days', async () => {
    const shippingAddress = { country: 'US', postalCode: '10001' };
    vi.mocked(getSessionCart).mockResolvedValue({ shippingAddress } as never);
    const days = [{ date: '2026-10-12', slots: [{ id: '20261012-10', start: 's', end: 'e', remaining: 3 }] }];
    vi.mocked(getSlotDays).mockResolvedValue({ ok: true, days });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(getSlotDays).toHaveBeenCalledWith({ shippingAddress });
    expect(await res.json()).toEqual({ days });
  });

  it('nextAvailableDate is passed through when present', async () => {
    vi.mocked(getSessionCart).mockResolvedValue({ shippingAddress: { country: 'US', postalCode: '10001' } } as never);
    vi.mocked(getSlotDays).mockResolvedValue({ ok: true, days: [], nextAvailableDate: '2026-10-20' });
    expect(await (await GET()).json()).toEqual({ days: [], nextAvailableDate: '2026-10-20' });
  });

  it('undeliverable address: 422', async () => {
    vi.mocked(getSessionCart).mockResolvedValue({ shippingAddress: { country: 'US', postalCode: '99999' } } as never);
    vi.mocked(getSlotDays).mockResolvedValue({ ok: false, error: 'UNDELIVERABLE' });
    const res = await GET();
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'UNDELIVERABLE' });
  });
});
