import { NextResponse } from 'next/server';
import { cartFailure, getSessionCart, jsonError } from '@/lib/cart-api';
import { getSlotDays } from '@/lib/slots/days';

/**
 * Bookable slots for the session cart's delivery address: `{ days: [{ date, slots }], nextAvailableDate? }`.
 * No cart or no address: 400 `NO_ADDRESS`. Address not deliverable: 422 `UNDELIVERABLE`.
 */
export async function GET() {
  try {
    const cart = await getSessionCart();
    const result = await getSlotDays({ shippingAddress: cart?.shippingAddress });
    if (!result.ok) return jsonError(result.error, result.error === 'NO_ADDRESS' ? 400 : 422);
    const body = { days: result.days, ...(result.nextAvailableDate ? { nextAvailableDate: result.nextAvailableDate } : {}) };
    return NextResponse.json(body,{ headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return cartFailure(e);
  }
}
