/** Types only: safe to import from client code. */
export interface Slot {
  /** `YYYYMMDD-HH`, e.g. `20261012-10` = 10:00-12:00 (stub: UTC). */
  id: string;
  /** ISO timestamps. */
  start: string;
  end: string;
  remaining: number;
}

export type HoldResult = { ok: true; expires: Date } | { ok: false; reason: 'FULL' | 'UNKNOWN' };

export interface SlotArea {
  country: string;
  postalCode: string;
}

export interface SlotService {
  /** Only slots with `remaining > 0`. */
  listSlots(a: SlotArea & { fromDate: Date; days: number }): Promise<Slot[]>;
  holdSlot(slotId: string, cartId: string, ttlMinutes: number): Promise<HoldResult>;
  releaseHold(cartId: string): Promise<void>;
  /** Idempotent per order; converts the hold of that slot (the given cart's, else the oldest) into a booking. */
  confirmBooking(slotId: string, orderId: string, cartId?: string): Promise<void>;
  nextAvailableDate(a: SlotArea & { fromDate: Date }): Promise<Date | null>;
}
