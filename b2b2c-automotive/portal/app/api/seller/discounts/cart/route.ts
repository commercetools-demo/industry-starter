// POST /api/seller/discounts/cart { storeKey, rule? } : creates an inactive cart discount scoped to the store (`stores`, custom type
// `mau-cart-discount-fields` with fundedBy reseller). Without `rule` it creates the draft "New cart rule (draft)".
// A rule with a `code` also creates the discount code (409 CODE_TAKEN when the code exists).
import { CreateCartBody } from '@/lib/catalog/route-schemas';
import { createDiscount, createDiscountDraft } from '@/lib/ct/seller/discounts';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, CreateCartBody, 'discount.edit');
  return json(body.rule ? await createDiscount(body.storeKey, 'cart', body.rule) : await createDiscountDraft(body.storeKey, 'cart'), { status: 201 });
});
