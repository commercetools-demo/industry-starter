import { cartResponse, invalidBody, readBody } from '@/lib/cart-api';
import { addToBundle } from '@/lib/ct/bundle';

export const dynamic = 'force-dynamic';

const MAX_QUANTITY = 99;
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '' && value.length <= 200;

/** Adds an offer variant. The server runs the guard on every add; the card's earlier verdict is never trusted. */
export async function POST(request: Request) {
  return cartResponse(async (session, market) => {
    const body = await readBody(request);
    const { offerKey, sku, quantity = 1, parentLineId, replaceLineId } = body;
    if (!isText(offerKey) || !isText(sku)) throw invalidBody('offerKey and sku are required.');
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw invalidBody('quantity must be a whole number of at least 1.');
    if (parentLineId !== undefined && !isText(parentLineId)) throw invalidBody('parentLineId is invalid.');
    if (replaceLineId !== undefined && !isText(replaceLineId)) throw invalidBody('replaceLineId is invalid.');
    return addToBundle(session, market, { offerKey, sku, quantity, parentLineId, replaceLineId });
  });
}
