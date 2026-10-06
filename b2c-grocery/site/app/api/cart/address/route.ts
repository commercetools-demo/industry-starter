import { CartNotActiveError } from '@/lib/ct/cart';
import { cartFailure, cartJson, cartSlotId, getSessionCart, jsonError, readJson } from '@/lib/cart-api';
import { clearSlot, ensureShippingMethod, setShippingAddress, ShippingMethodUnavailableError } from '@/lib/ct/cart-delivery';
import { getSlotService } from '@/lib/slots';
import { isDeliverable, isValidPostalCode } from '@/lib/slots/deliverable';
import { getMarket } from '@/lib/session';
import type { Address } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

const REQUIRED = ['firstName', 'lastName', 'streetName', 'postalCode', 'city', 'country'] as const;
const OPTIONAL = ['additionalStreetInfo', 'phone'] as const;
const MAX_LENGTH = 100;

function parseAddress(body: Record<string, unknown>): { address: Address } | { fields: string[] } {
  const fields: string[] = [];
  const text = (name: string): string => {
    const v = body[name];
    return typeof v === 'string' ? v.trim() : '';
  };
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    const v = text(name);
    if (v.length > MAX_LENGTH || (REQUIRED as readonly string[]).includes(name) && v === '') fields.push(name);
  }
  const country = text('country');
  const countries = Object.values(COUNTRY_CONFIG).map((c) => c.country);
  if (country !== '' && !countries.includes(country)) fields.push('country');
  else if (country !== '' && text('postalCode') !== '' && !isValidPostalCode(country, text('postalCode'))) fields.push('postalCode');
  if (fields.length > 0) return { fields: [...new Set(fields)] };
  return {
    address: {
      firstName: text('firstName'),
      lastName: text('lastName'),
      streetName: text('streetName'),
      postalCode: text('postalCode'),
      city: text('city'),
      country,
      ...(text('additionalStreetInfo') ? { additionalStreetInfo: text('additionalStreetInfo') } : {}),
      ...(text('phone') ? { phone: text('phone') } : {}),
    },
  };
}

/**
 * Saves the delivery address on the session cart.
 * - Invalid shape: 400 `INVALID_ADDRESS` with the failing `fields`.
 * - Country other than the cart's market: 422 `COUNTRY_MISMATCH` (commercetools rejects a shipping zone without a rate for the cart currency).
 * - Valid but not deliverable (postcode `00…`/`99…`): the address is saved (so the cart tells the truth and checkout stays blocked),
 *   a picked slot is released and cleared, answer 422 `UNDELIVERABLE` with `{ cart, slotCleared }`. No shipping method is set.
 * - Deliverable: sets the `standard` shipping method; answers `{ cart, slotCleared: false }`; a picked slot stays.
 */
export async function PUT(request: Request) {
  const parsed = parseAddress(await readJson(request));
  if ('fields' in parsed) return jsonError('INVALID_ADDRESS', 400, { fields: parsed.fields });
  const { address } = parsed;

  try {
    const existing = await getSessionCart();
    if (!existing) return await cartFailure(new CartNotActiveError('session'));
    const market = await getMarket();
    if (address.country !== (existing.country ?? market.country)) return jsonError('COUNTRY_MISMATCH', 422);

    const deliverable = isDeliverable(address.country, address.postalCode ?? '');
    let cart = await setShippingAddress(existing.id, address);
    if (deliverable) {
      cart = await ensureShippingMethod(existing.id);
      return await cartJson(cart, market, {}, { extra: { slotCleared: false } });
    }
    const slotCleared = cartSlotId(cart) !== undefined;
    if (slotCleared) {
      await getSlotService().releaseHold(existing.id);
      cart = await clearSlot(existing.id);
    }
    return await cartJson(cart, market, {}, { status: 422, extra: { error: 'UNDELIVERABLE', slotCleared } });
  } catch (e) {
    if (e instanceof ShippingMethodUnavailableError) return jsonError('SHIPPING_UNAVAILABLE', 422);
    return cartFailure(e);
  }
}
