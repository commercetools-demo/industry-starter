import { accountRoute, AccountRefusal, readJsonBody } from '@/lib/api/account-api';
import { withListErrors } from '@/lib/api/lists-api';
import { LIST_LINE_QUANTITY_MAX, LIST_LINE_QUANTITY_MIN } from '@/lib/config/lists';
import { addOffer, toDetail } from '@/lib/ct/lists';
import { getMarket } from '@/lib/market/server';

export const dynamic = 'force-dynamic';

/** Saves an offer variant on the list. Saving the same offer and variant again changes nothing. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return accountRoute(request, { mutating: true }, ({ session }) =>
    withListErrors(async () => {
      const { id } = await params;
      const body = await readJsonBody(request);
      const { offerKey, variantId, quantity } = body;
      if (typeof offerKey !== 'string' || offerKey === '' || offerKey.length > 200) throw new AccountRefusal(400, 'INVALID_BODY', 'offerKey is required.');
      if (variantId !== undefined && (typeof variantId !== 'number' || !Number.isInteger(variantId) || variantId < 1)) throw new AccountRefusal(400, 'INVALID_BODY', 'variantId must be a whole number.');
      if (quantity !== undefined && (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < LIST_LINE_QUANTITY_MIN || quantity > LIST_LINE_QUANTITY_MAX)) {
        throw new AccountRefusal(400, 'INVALID_BODY', `quantity must be ${LIST_LINE_QUANTITY_MIN} to ${LIST_LINE_QUANTITY_MAX}.`);
      }
      const market = await getMarket();
      return { list: await toDetail(await addOffer(session.customerId, id, { offerKey, variantId, quantity }, market), market) };
    }),
  );
}
