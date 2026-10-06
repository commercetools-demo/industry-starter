import { describe, expect, it, vi } from 'vitest';
import { SLOT_CONFIG } from '../config/slots';
import { getSlotDays } from './days';
import { createStubSlotService } from './stub-service';
import type { SlotService } from './types';

vi.mock('./index', () => ({ getSlotService: () => ({}) }));

const now = () => new Date('2026-10-12T09:00:00Z');
const address = { country: 'US', postalCode: '10001' };
const slot = (id: string, remaining = 10) => ({ id, start: `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}T${id.slice(9)}:00:00.000Z`, end: 'x', remaining });

describe('getSlotDays', () => {
  it('no address: NO_ADDRESS', async () => {
    expect(await getSlotDays({}, { now })).toEqual({ ok: false, error: 'NO_ADDRESS' });
    expect(await getSlotDays({ shippingAddress: { country: 'US' } }, { now })).toEqual({ ok: false, error: 'NO_ADDRESS' });
  });

  it('undeliverable address: UNDELIVERABLE, no service call', async () => {
    const service = { listSlots: vi.fn() } as unknown as SlotService;
    expect(await getSlotDays({ shippingAddress: { country: 'US', postalCode: '99999' } }, { service, now })).toEqual({ ok: false, error: 'UNDELIVERABLE' });
    expect(service.listSlots).not.toHaveBeenCalled();
  });

  it('groups slots by day over the whole horizon, without nextAvailableDate', async () => {
    const service = createStubSlotService({ now });
    const r = await getSlotDays({ shippingAddress: address }, { service, now });
    if (!r.ok) throw new Error('expected ok');
    expect(r.days).toHaveLength(SLOT_CONFIG.days);
    expect(r.days[0].date).toBe('2026-10-12');
    expect(r.days[0].slots.map((s) => s.id)).toEqual(['20261012-10', '20261012-12', '20261012-14', '20261012-16', '20261012-18']);
    expect(r.days[1].slots).toHaveLength(6);
    expect(r.days.at(-1)?.date).toBe('2026-10-18');
    expect(r.nextAvailableDate).toBeUndefined();
  });

  it('a day without capacity is listed with no slots; still no nextAvailableDate', async () => {
    const listSlots = vi.fn().mockResolvedValue([slot('20261013-10')]);
    const r = await getSlotDays({ shippingAddress: address }, { service: { listSlots } as unknown as SlotService, now });
    if (!r.ok) throw new Error('expected ok');
    expect(r.days[0]).toEqual({ date: '2026-10-12', slots: [] });
    expect(r.days[1].slots).toHaveLength(1);
    expect(r.nextAvailableDate).toBeUndefined();
  });

  it('nextAvailableDate only when no slot has capacity', async () => {
    const service = {
      listSlots: vi.fn().mockResolvedValue([]),
      nextAvailableDate: vi.fn().mockResolvedValue(new Date('2026-10-20T00:00:00Z')),
    } as unknown as SlotService;
    const r = await getSlotDays({ shippingAddress: address }, { service, now });
    expect(r).toMatchObject({ ok: true, nextAvailableDate: '2026-10-20' });
    expect(service.nextAvailableDate).toHaveBeenCalledWith({ ...address, fromDate: now() });
  });

  it('nothing at all (no next date either): no nextAvailableDate key', async () => {
    const service = { listSlots: vi.fn().mockResolvedValue([]), nextAvailableDate: vi.fn().mockResolvedValue(null) } as unknown as SlotService;
    const r = await getSlotDays({ shippingAddress: address }, { service, now });
    expect(r).toMatchObject({ ok: true });
    expect('nextAvailableDate' in r).toBe(false);
  });
});
