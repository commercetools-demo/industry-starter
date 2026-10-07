import { customerIdOf, wishlistError, wishlistFailure, wishlistJson } from '@/lib/api/wishlist-api';
import { unsaveProduct } from '@/lib/ct/shopping-lists';

/** Remove a product from the list (idempotent). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const customerId = await customerIdOf();
  if (!customerId) return wishlistError('UNAUTHORIZED', 401);
  const { productId } = await params;
  try {
    return wishlistJson(await unsaveProduct(customerId, productId));
  } catch (e) {
    return wishlistFailure(e);
  }
}
