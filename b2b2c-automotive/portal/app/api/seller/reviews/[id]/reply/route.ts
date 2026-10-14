// POST /api/seller/reviews/[id]/reply { storeKey, text } : the store's public reply (V-16). Text of 1 to 1,000 characters, rendered as
// text. The review must carry this store's key (else 404). `replyBy` is the store's display name, which the storefront shows.
import { z } from 'zod';
import { REPLY_MAX, replyToReview } from '@/lib/ct/seller/reviews';
import { json } from '@/lib/portal/route-kit';
import { getPorts } from '@/lib/portal/seam';
import { authorizedBody, authorizeSeller, sellerHandle, StoreKey } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

const Body = z.object({ storeKey: StoreKey, text: z.string().trim().min(1).max(REPLY_MAX) }).strict();

export const POST = sellerHandle(async (request: Request, context: Params<'id'>) => {
  const body = await authorizedBody(request, Body, 'reviews.moderate');
  const id = await pathParam(context, 'id');
  const session = await authorizeSeller(body.storeKey, 'reviews.moderate');
  const viewer = await getPorts().loadViewer(session);
  return json(await replyToReview(body.storeKey, id, body.text, viewer?.storeName ?? body.storeKey));
});
