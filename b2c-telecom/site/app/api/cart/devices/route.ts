import { BundleRefusal } from '@/lib/cart/errors';
import { cartResponse, readBody } from '@/lib/cart-api';
import { addDeviceToBundle } from '@/lib/ct/device-bundle';
import { parseAddBody } from '@/lib/devices/input';

export const dynamic = 'force-dynamic';

/**
 * Adds a handset in one acquisition mode (pay in full, installments over a term, lease). The answer is the full server cart.
 * 409 MODE_UNAVAILABLE / TERM_UNAVAILABLE name what is available; 422 PRICE_NOT_FOR_TERM means the price did not come from the policy
 * of the term and the line was taken out again.
 */
export async function POST(request: Request) {
  return cartResponse(async (session, market) => {
    const parsed = parseAddBody(await readBody(request));
    if (!parsed.ok) throw new BundleRefusal(400, 'INVALID_INPUT', parsed.message);
    return addDeviceToBundle(session, market, parsed);
  });
}
