// POST /api/seller/tailoring/[productId]/image-url { storeKey, url } : fetches the pasted address once and validates the bytes
// (https only, no credentials, no private network address, redirects checked, 5 s, 10 MB; then the same limits as an upload).
// Returns `{ url, width, height }`; it does not save.
import { CatalogError } from '@/lib/catalog/errors';
import { ImageUrlBody } from '@/lib/catalog/route-schemas';
import { URL_REFUSED_MESSAGE } from '@/lib/catalog/image-url';
import { isCleanHttpsUrl } from '@/lib/catalog/tailoring-schema';
import { checkImageUrl } from '@/lib/ct/seller/tailoring';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, ImageUrlBody, 'tailoring.edit');
  if (!isCleanHttpsUrl(body.url)) throw new CatalogError(400, 'IMAGE_URL_REFUSED', URL_REFUSED_MESSAGE);
  const checked = await checkImageUrl(body.url);
  return json({ url: checked.url, width: checked.width, height: checked.height });
});
