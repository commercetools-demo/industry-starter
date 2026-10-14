// POST /api/seller/discounts/product { storeKey, rule? } : creates an inactive product discount limited to the store's retail
// channel. Without `rule` it creates the draft "New product rule (draft)" (unscheduled) for the editor to complete.
import { CreateProductBody } from '@/lib/catalog/route-schemas';
import { createDiscount, createDiscountDraft } from '@/lib/ct/seller/discounts';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, CreateProductBody, 'discount.edit');
  return json(body.rule ? await createDiscount(body.storeKey, 'product', body.rule) : await createDiscountDraft(body.storeKey, 'product'), { status: 201 });
});
