// GET /api/seller/store/link-in-bio-status?storeKey= (workstream U-05): whether the store has a published page with slug
// /link-in-bio, for the notice on the Share tab.
import { hasPublishedPage } from '@/lib/contentools/service';
import { json } from '@/lib/portal/route-kit';
import { LINK_IN_BIO_SLUG } from '@/lib/portal/share-links';
import { authorizeQuery, storeHandle } from '@/lib/portal/store-route';

export const GET = storeHandle(async (request: Request) => {
  const { storeKey } = await authorizeQuery(request, 'store.view');
  return json({ published: await hasPublishedPage(storeKey, LINK_IN_BIO_SLUG) });
});
