import { CartNotActiveError } from '@/lib/ct/cart';
import { cartFailure, cartJson, getSessionCart, jsonError, readJson } from '@/lib/cart-api';
import { SLOT_CONFIG } from '@/lib/config/slots';
import { clearSlot, setSlot } from '@/lib/ct/cart-delivery';
import { getMarket } from '@/lib/session';
import { getSlotService } from '@/lib/slots';
import { getSlotDays } from '@/lib/slots/days';
import { slotWindow } from '@/lib/slots/window';

/**
 * Picks a slot for the session cart: holds it for 15 minutes, then writes it to the cart.
 * No cart: 404; no (or undeliverable) address: 400 `NO_ADDRESS` / 422 `UNDELIVERABLE`; unknown slot id: 400 `UNKNOWN_SLOT`;
 * no capacity: 409 `SLOT_FULL` with fresh `days` so the picker can refresh.
 */
export async function PUT(request: Request) {
  const { slotId } = await readJson(request);
  if (typeof slotId !== 'string' || slotId === '') return jsonError('INVALID_SLOT', 400);
  const times = slotWindow(slotId);
  if (!times) return jsonError('UNKNOWN_SLOT', 400);

  try {
    const cart = await getSessionCart();
    if (!cart) return await cartFailure(new CartNotActiveError('session'));
    const days = await getSlotDays({ shippingAddress: cart.shippingAddress });
    if (!days.ok) return jsonError(days.error, days.error === 'NO_ADDRESS' ? 400 : 422);

    const service = getSlotService();
    const hold = await service.holdSlot(slotId, cart.id, SLOT_CONFIG.holdMinutes);
    if (!hold.ok) {
      if (hold.reason === 'UNKNOWN') return jsonError('UNKNOWN_SLOT', 400);
      const fresh = await getSlotDays({ shippingAddress: cart.shippingAddress });
      return jsonError('SLOT_FULL', 409, fresh.ok ? { days: fresh.days, ...(fresh.nextAvailableDate ? { nextAvailableDate: fresh.nextAvailableDate } : {}) } : {});
    }
    try {
      const updated = await setSlot(cart.id, { id: slotId, ...times, holdExpires: hold.expires.toISOString() });
      return await cartJson(updated, await getMarket());
    } catch (e) {
      await service.releaseHold(cart.id);
      throw e;
    }
  } catch (e) {
    return cartFailure(e);
  }
}

/** Gives the slot back: releases the hold and clears the cart's slot fields. */
export async function DELETE() {
  try {
    const cart = await getSessionCart();
    if (!cart) return await cartFailure(new CartNotActiveError('session'));
    await getSlotService().releaseHold(cart.id);
    return await cartJson(await clearSlot(cart.id), await getMarket());
  } catch (e) {
    return cartFailure(e);
  }
}
