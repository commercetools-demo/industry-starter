import { handle, jsonError, requireCustomer } from '@/lib/api';
import { listPaymentMethods, setDefaultPaymentMethod } from '@/lib/ct/payment-methods';
import { toPaymentMethodView } from '@/lib/mappers/payment-method';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** POST /api/account/payment-methods/[id]/default -> 200 { methods }. The current default is cleared first. 404 as for DELETE. */
export const POST = handle('/api/account/payment-methods/[id]/default', async (_req, ctx) => {
  const { customerId } = await requireCustomer();
  const { id } = await ctx.params;
  if (!ID.test(id)) return jsonError('not_found', 404);
  await setDefaultPaymentMethod(customerId, id);
  const { locale } = await getMarket();
  const methods = await listPaymentMethods(customerId);
  return Response.json({ methods: methods.map((m) => toPaymentMethodView(m, locale)) }, { headers: { 'Cache-Control': 'no-store' } });
});
