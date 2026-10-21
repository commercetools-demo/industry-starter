import { handle, requireCustomer } from '@/lib/api';
import { listPaymentMethods } from '@/lib/ct/payment-methods';
import { toPaymentMethodView } from '@/lib/mappers/payment-method';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/payment-methods -> 200 { methods: PaymentMethodView[], hostedOnly: true }. The cards are saved by the
 * hosted Checkout; there is no add. A view has an id, a version, a label, the method key and the default flag, never the
 * token. An upstream failure is `503 upstream_unavailable` and affects this panel only.
 */
export const GET = handle('/api/account/payment-methods', async () => {
  const { customerId } = await requireCustomer();
  const { locale } = await getMarket();
  const methods = await listPaymentMethods(customerId);
  return Response.json(
    { methods: methods.map((m) => toPaymentMethodView(m, locale)), hostedOnly: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
