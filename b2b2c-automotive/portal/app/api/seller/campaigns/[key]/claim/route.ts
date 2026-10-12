// POST /api/seller/campaigns/[key]/claim { storeKey, amountCents, invoiceReference, note } : proof of spend (W-03). No file upload
// (Q-W09). The status is always `submitted`; Malva approves or rejects in the Merchant Center.
import { submitClaim } from '@/lib/ct/seller/campaigns';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';
import { ClaimBody } from '@/lib/portal/w-schemas';

export const POST = sellerHandle(async (request: Request, context: Params<'key'>) => {
  const body = await authorizedBody(request, ClaimBody, 'marketing.manage');
  const key = await pathParam(context, 'key');
  return json(await submitClaim(body.storeKey, key, { amountCents: body.amountCents, invoiceReference: body.invoiceReference, note: body.note }), { status: 201 });
});
