import { SLOT_CONFIG } from '../config/slots';
import { isDeliverable } from './deliverable';
import { getSlotService } from './index';
import type { Slot, SlotDay, SlotService } from './types';

export type { SlotDay } from './types';

export type SlotDaysResult =
  | { ok: true; days: SlotDay[]; /** Only when no slot in the horizon has capacity and a later day exists. */ nextAvailableDate?: string }
  | { ok: false; error: 'NO_ADDRESS' | 'UNDELIVERABLE' };

/** The part of a cart (SDK or app shape) that decides the delivery area. */
export interface CartWithAddress {
  shippingAddress?: { country: string; postalCode?: string };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The bookable slots for the cart's address, grouped by day for the whole horizon (days without capacity are present
 * with `slots: []`). Used by `GET /api/slots`, by the `SLOT_FULL` answer of `PUT /api/cart/slot` and by V.
 */
export async function getSlotDays(
  cart: CartWithAddress,
  { service = getSlotService(), now = () => new Date() }: { service?: SlotService; now?: () => Date } = {},
): Promise<SlotDaysResult> {
  const address = cart.shippingAddress;
  if (!address?.country || !address.postalCode) return { ok: false, error: 'NO_ADDRESS' };
  if (!isDeliverable(address.country, address.postalCode)) return { ok: false, error: 'UNDELIVERABLE' };

  const area = { country: address.country, postalCode: address.postalCode };
  const fromDate = now();
  const slots = await service.listSlots({ ...area, fromDate, days: SLOT_CONFIG.days });

  const byDate = new Map<string, Slot[]>();
  const first = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate());
  for (let i = 0; i < SLOT_CONFIG.days; i++) byDate.set(isoDate(new Date(first + i * 86_400_000)), []);
  for (const slot of slots) byDate.get(slot.start.slice(0, 10))?.push(slot);
  const days = [...byDate].map(([date, daySlots]) => ({ date, slots: daySlots }));

  if (slots.length > 0) return { ok: true, days };
  const next = await service.nextAvailableDate({ ...area, fromDate });
  return { ok: true, days, ...(next ? { nextAvailableDate: isoDate(next) } : {}) };
}
