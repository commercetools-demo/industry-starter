// GET /api/seller/reviews?storeKey=&tab=latest|highest|lowest : the store's reviews with the rating summary (V-16).
import { listReviews } from '@/lib/ct/seller/reviews';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { localeParam } from '@/lib/portal/v-route';
import type { ReviewTab } from '@/lib/v-types';

const TABS: readonly ReviewTab[] = ['latest', 'highest', 'lowest'];

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'reviews.view');
  const tab = new URL(request.url).searchParams.get('tab');
  return json(await listReviews(storeKey, TABS.find((t) => t === tab) ?? 'latest', localeParam(request)));
});
