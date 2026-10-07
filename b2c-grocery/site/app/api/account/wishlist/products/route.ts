import { privateJson } from '@/lib/api/private-json';
import { customerIdOf, wishlistError, wishlistFailure } from '@/lib/api/wishlist-api';
import { getSavedProducts } from '@/lib/ct/shopping-lists';
import { marketFor } from '@/lib/market';

/** The saved products, priced for the market of `?locale=` (the page's URL locale; the session market is the fallback). */
export async function GET(request: Request) {
  const customerId = await customerIdOf();
  if (!customerId) return wishlistError('UNAUTHORIZED', 401);
  try {
    const locale = new URL(request.url).searchParams.get('locale') ?? '';
    return privateJson({ products: await getSavedProducts(customerId, await marketFor(locale)) });
  } catch (e) {
    return wishlistFailure(e);
  }
}
