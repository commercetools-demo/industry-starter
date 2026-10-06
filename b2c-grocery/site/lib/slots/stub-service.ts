import { SLOT_CONFIG } from '../config/slots';
import type { HoldResult, Slot, SlotService } from './types';
import { DAY_MS, HOUR_MS, parseSlotId, slotIdOf, startOfUtcDay } from './window';

interface Hold { slotId: string; expires: number }

/**
 * In-memory slot capacity (module state, resets on cold start: acceptable stub, SO-12).
 * Capacity is global (area is ignored), seeded lazily: a slot with no holds or bookings has `capacity` remaining.
 * Slot times are UTC. `now` is injectable for tests.
 */
export function createStubSlotService({ now = () => new Date() }: { now?: () => Date } = {}): SlotService {
  const holds = new Map<string, Hold>(); // by cartId: one hold per cart
  const bookings = new Map<string, string>(); // orderId -> slotId

  const purgeExpired = () => {
    const t = now().getTime();
    for (const [cartId, h] of holds) if (h.expires <= t) holds.delete(cartId);
  };
  const taken = (slotId: string, exceptCartId?: string) => {
    let n = 0;
    for (const [cartId, h] of holds) if (h.slotId === slotId && cartId !== exceptCartId) n++;
    for (const s of bookings.values()) if (s === slotId) n++;
    return n;
  };
  const bookable = (startMs: number, dayMs: number) => {
    const t = now().getTime();
    const firstDay = startOfUtcDay(now());
    return startMs > t && dayMs >= firstDay && dayMs < firstDay + SLOT_CONFIG.days * DAY_MS;
  };

  async function listSlots({ fromDate, days }: { fromDate: Date; days: number }): Promise<Slot[]> {
    purgeExpired();
    const t = now().getTime();
    const firstDay = Math.max(startOfUtcDay(fromDate), startOfUtcDay(now()));
    const lastDay = Math.min(firstDay + days * DAY_MS, startOfUtcDay(now()) + SLOT_CONFIG.days * DAY_MS);
    const slots: Slot[] = [];
    for (let day = firstDay; day < lastDay; day += DAY_MS) {
      for (const hour of SLOT_CONFIG.windows) {
        const start = day + hour * HOUR_MS;
        if (start <= t) continue; // already started
        const id = slotIdOf(day, hour);
        const remaining = SLOT_CONFIG.capacity - taken(id);
        if (remaining <= 0) continue;
        slots.push({ id, start: new Date(start).toISOString(), end: new Date(start + SLOT_CONFIG.windowHours * HOUR_MS).toISOString(), remaining });
      }
    }
    return slots;
  }

  async function holdSlot(slotId: string, cartId: string, ttlMinutes: number): Promise<HoldResult> {
    purgeExpired();
    const parsed = parseSlotId(slotId);
    if (!parsed || !bookable(parsed.startMs, parsed.dayMs)) return { ok: false, reason: 'UNKNOWN' };
    // The cart's own current hold does not count against the slot it is moving to or renewing.
    if (SLOT_CONFIG.capacity - taken(slotId, cartId) <= 0) return { ok: false, reason: 'FULL' };
    const expires = now().getTime() + ttlMinutes * 60_000;
    holds.set(cartId, { slotId, expires });
    return { ok: true, expires: new Date(expires) };
  }

  async function releaseHold(cartId: string): Promise<void> {
    purgeExpired();
    holds.delete(cartId);
  }

  /**
   * Idempotent per order. Converts a hold on that slot into the booking: the given cart's hold when `cartId` is
   * passed, otherwise the oldest hold on the slot. A booking without any live hold is still recorded.
   */
  async function confirmBooking(slotId: string, orderId: string, cartId?: string): Promise<void> {
    purgeExpired();
    if (bookings.has(orderId)) return;
    const own = cartId !== undefined && holds.get(cartId)?.slotId === slotId ? cartId : undefined;
    const victim = own ?? [...holds].find(([, h]) => h.slotId === slotId)?.[0];
    if (victim !== undefined) holds.delete(victim);
    bookings.set(orderId, slotId);
  }

  async function nextAvailableDate({ fromDate }: { fromDate: Date }): Promise<Date | null> {
    const slots = await listSlots({ fromDate, days: SLOT_CONFIG.days });
    return slots.length > 0 ? new Date(startOfUtcDay(new Date(slots[0].start))) : null;
  }

  return { listSlots, holdSlot, releaseHold, confirmBooking, nextAvailableDate };
}
