// GET /api/seller/local-products?storeKey= and POST { storeKey, name, sku, priceCents, categoryKey, type, brandName?, fitment? } (W-12, W-15).
// The body is strict: a `publish`, `reviewState` or `prices` field is 400. A fitment claim never publishes; it waits for Malva.
// A SKU that exists anywhere in the project is 409 with `field: 'sku'` and the generic text "SKU already in use".
import { createLocalProduct, listLocalProducts } from '@/lib/ct/seller/local-products';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { LocalProductBody } from '@/lib/portal/w-schemas';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'import.run');
  return json({ products: await listLocalProducts(storeKey) });
});

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, LocalProductBody, 'import.run');
  const { storeKey, ...input } = body;
  return json(await createLocalProduct(storeKey, input), { status: 201 });
});
