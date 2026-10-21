import { handle, jsonError, requireCustomer } from '@/lib/api';
import { listPaymentMethods, removePaymentMethod } from '@/lib/ct/payment-methods';
import { toPaymentMethodView } from '@/lib/mappers/payment-method';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * DELETE /api/account/payment-methods/[id] -> 200 { methods }. Sets the method `Inactive` (it is not deleted, and the token at
 * the payment service is not revoked). A default method becomes non-default first and no other is promoted. 404 for an
 * unknown, a foreign and an already removed method alike.
 */
export const DELETE = handle('/api/account/payment-methods/[id]', async (_req, ctx) => {
  const { customerId } = await requireCustomer();
  const { id } = await ctx.params;
  if (!ID.test(id)) return jsonError('not_found', 404);
  await removePaymentMethod(customerId, id);
  const { locale } = await getMarket();
  const methods = await listPaymentMethods(customerId);
  return Response.json({ methods: methods.map((m) => toPaymentMethodView(m, locale)) }, { headers: { 'Cache-Control': 'no-store' } });
});
