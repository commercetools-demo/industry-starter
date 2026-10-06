import type { CartSlot } from './types';

/** A slot counts while its hold has not expired (a slot without hold info is treated as active). */
export function isSlotActive(slot: CartSlot | undefined, now: Date = new Date()): slot is CartSlot {
  if (!slot) return false;
  if (!slot.holdExpires) return true;
  const expires = Date.parse(slot.holdExpires);
  return Number.isNaN(expires) || expires > now.getTime();
}
