// GET /api/seller/bundles?storeKey= and POST { storeKey, name, discountPercent, components: [{ sku, qty }] } (W-09, W-10).
// The server recomputes every price from the store's own retail prices; the body carries no price. Components must be assigned to
// the store (409 COMPONENT_NOT_ASSIGNED naming the SKU). A bundle is created as a Draft.
import { createBundle, listBundles } from '@/lib/ct/seller/bundles';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { BundleBody } from '@/lib/portal/w-schemas';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'bundles.manage');
  return json({ bundles: await listBundles(storeKey) });
});

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, BundleBody, 'bundles.manage');
  return json(await createBundle(body.storeKey, { name: body.name, discountPercent: body.discountPercent, components: body.components }), { status: 201 });
});
