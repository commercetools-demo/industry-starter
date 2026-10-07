import { privateJson } from '@/lib/api/private-json';
import { customerIdOf, wishlistError, wishlistFailure, wishlistJson } from '@/lib/api/wishlist-api';
import { readJson } from '@/lib/cart-api';
import { getSavedProductIds, saveProduct } from '@/lib/ct/shopping-lists';

/** Saved product ids of the signed-in customer, newest first. A read never creates the list. */
export async function GET() {
  const customerId = await customerIdOf();
  if (!customerId) return wishlistError('UNAUTHORIZED', 401);
  try {
    return privateJson({ productIds: await getSavedProductIds(customerId) });
  } catch (e) {
    return wishlistFailure(e);
  }
}

/** Save a product (idempotent). Answers with the full id list so the client cache stays in step. */
export async function POST(request: Request) {
  const customerId = await customerIdOf();
  if (!customerId) return wishlistError('UNAUTHORIZED', 401);
  const { productId } = await readJson(request);
  if (typeof productId !== 'string' || productId.trim() === '') return wishlistError('INVALID_PRODUCT', 400);
  try {
    return wishlistJson(await saveProduct(customerId, productId));
  } catch (e) {
    return wishlistFailure(e);
  }
}
