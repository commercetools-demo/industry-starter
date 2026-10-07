import { cartResponse, invalidBody, readBody } from '@/lib/cart-api';
import { POSTAL_CODE_PATTERN } from '@/lib/config/cart';
import { setBundleAddress } from '@/lib/ct/bundle';
import { normalizePostalCode } from '@/lib/offers/serviceability';

export const dynamic = 'force-dynamic';

/**
 * Where the bundle will be served. Sets the cart's `postalCode` custom field, the serviceability flags and the shipping address
 * (U extends the address later) and remembers the ZIP in the cookie K reads. The answer carries K's issues for the new location.
 */
export async function POST(request: Request) {
  return cartResponse(async (session, market) => {
    const { postalCode, country } = await readBody(request);
    if (country !== undefined && country !== market.country) throw invalidBody('country must match your market.');
    const text = typeof postalCode === 'string' ? postalCode.trim() : '';
    const normalized = POSTAL_CODE_PATTERN.test(text) ? normalizePostalCode(text, market.country) : null;
    if (normalized === null) throw invalidBody('postalCode must be a five digit code.');
    return setBundleAddress(session, market, { postalCode: normalized });
  });
}
