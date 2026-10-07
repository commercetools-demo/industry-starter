import { cartResponse, invalidBody, readBody } from '@/lib/cart-api';
import { applyDiscountCode, removeDiscountCode } from '@/lib/ct/bundle';

export const dynamic = 'force-dynamic';

const MAX_CODE_LENGTH = 64;
const validCode = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && value.length <= MAX_CODE_LENGTH;

/** Applies a code. A code that does not match is taken off again: 422 DISCOUNT_CODE_REJECTED with `details.reason` and the unchanged cart. */
export async function POST(request: Request) {
  return cartResponse(async (session, market) => {
    const { code } = await readBody(request);
    if (!validCode(code)) throw invalidBody('code is required.');
    return applyDiscountCode(session, market, code);
  });
}

/** Removes a code (`?code=MALVA-CABLE5`), also one that no longer applies. */
export async function DELETE(request: Request) {
  return cartResponse(async (session, market) => {
    const code = new URL(request.url).searchParams.get('code');
    if (!validCode(code)) throw invalidBody('code is required.');
    return removeDiscountCode(session, market, code);
  });
}
