// POST /api/seller/customers/[id]/shop-as { storeKey } : "Shop as customer" (V-06). Admin only (Q-W01). Reads the customer in-store (404
// when not of this store), records a single-use handoff, signs a 60 second token and returns where the browser POSTs it (the token is
// never put in a URL). The portal session gets `actingAs` so the shell shows the banner. The storefront landing is deferred.
import { z } from 'zod';
import { CatalogError } from '@/lib/catalog/errors';
import { startShopAs } from '@/lib/ct/seller/impersonation';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, StoreKey } from '@/lib/portal/seller-route';
import { writeSession } from '@/lib/portal/seam';
import { storefrontOrigin } from '@/lib/portal/storefront-origin';
import { pathParam, type Params } from '@/lib/portal/w-route';

const Body = z.object({ storeKey: StoreKey }).strict();

export const POST = sellerHandle(async (request: Request, context: Params<'id'>) => {
  const body = await authorizedBody(request, Body, 'customer-session.start');
  const id = await pathParam(context, 'id');
  const session = await authorizeSeller(body.storeKey, 'customer-session.start');
  const origin = storefrontOrigin();
  if (!origin) throw new CatalogError(409, 'NOT_CONFIGURED', 'The storefront address is not set up for this portal');
  const { token, name } = await startShopAs(body.storeKey, id, session.customerId as string);
  await writeSession((current) => ({ ...current, actingAs: name }));
  return json({ action: `${origin}/api/impersonate`, token });
});
