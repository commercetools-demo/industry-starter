// GET, PATCH, DELETE /api/seller/discounts/[kind]/[id] (T-09). Ownership is checked by id before anything is read or written:
// a discount of another store answers 404 (not 403, so existence does not leak); Malva-funded ones answer 403 LOCKED_MALVA_FUNDED
// to PATCH and DELETE. PATCH saves a complete rule; the store's channel clause or `stores` can never change.
import { DiscountKindParam, PatchCartBody, PatchProductBody } from '@/lib/catalog/route-schemas';
import { deleteDiscount, getDiscount, updateDiscount } from '@/lib/ct/seller/discounts';
import { ApiError, json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';

type Context = { params: Promise<{ kind: string; id: string }> };

async function kindOf(context: Context) {
  const { kind, id } = await context.params;
  const parsed = DiscountKindParam.safeParse(kind);
  if (!parsed.success) throw new ApiError(404, 'Not found');
  return { kind: parsed.data, id };
}

export const GET = sellerHandle(async (request: Request, context: Context) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'catalog.view');
  const { kind, id } = await kindOf(context);
  return json(await getDiscount(storeKey, kind, id));
});

export const PATCH = sellerHandle(async (request: Request, context: Context) => {
  const { kind, id } = await kindOf(context);
  if (kind === 'product') {
    const body = await authorizedBody(request, PatchProductBody, 'discount.edit');
    return json(await updateDiscount(body.storeKey, 'product', id, body.rule));
  }
  const body = await authorizedBody(request, PatchCartBody, 'discount.edit');
  return json(await updateDiscount(body.storeKey, 'cart', id, body.rule));
});

export const DELETE = sellerHandle(async (request: Request, context: Context) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'discount.edit');
  const { kind, id } = await kindOf(context);
  await deleteDiscount(storeKey, kind, id);
  return json({ deleted: true });
});
