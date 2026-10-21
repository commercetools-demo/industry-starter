import { handle, jsonError, requireCustomer } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { validateReturnRequest } from '@/lib/account/returns';
import { addReturn, getOrderById } from '@/lib/ct/account-orders';
import { mapOrderDetail } from '@/lib/mappers/account-order';
import { getMarket } from '@/lib/session';
import { RETURN_WINDOW_DAYS } from '@/lib/shop-config';

export const dynamic = 'force-dynamic';

const ORDER_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * POST /api/orders/[id]/returns { items: [{ lineId, quantity, reason? }] } -> 200 { order: OrderDetailView }.
 * The My Orders API is read-only, so this runs here after the ownership check (a foreign or unknown id is the same 404).
 * 409 not_returnable (not completed, or nothing left to return), 409 return_window_closed, 422 validation_failed with
 * `fields` (a quantity above what remains is refused). The new return starts as shipment state `Advised`.
 */
export const POST = handle('/api/orders/[id]/returns', async (req, ctx) => {
  const { customerId } = await requireCustomer();
  const { id } = await ctx.params;
  if (!ORDER_ID.test(id)) return jsonError('not_found', 404);
  const body: unknown = await req.json().catch(() => null);

  const order = await getOrderById(customerId, id);
  if (!order) return jsonError('not_found', 404);
  const { locale } = await getMarket();
  const view = mapOrderDetail(order, locale);

  if (view.status !== 'completed') return domainError('not_returnable', 409);
  if (!Object.values(view.returnable).some((q) => q > 0)) return domainError('not_returnable', 409);
  if (!view.canReturn) return domainError('return_window_closed', 409, { windowDays: RETURN_WINDOW_DAYS });

  const checked = validateReturnRequest(body, view.returnable);
  if (!checked.ok) return Response.json({ error: { code: 'validation_failed', message: 'Some of the information is not valid', fields: checked.fields } }, { status: 422 });

  const updated = await addReturn(order.id, checked.items);
  return Response.json({ order: mapOrderDetail(updated, locale) }, { headers: { 'Cache-Control': 'no-store' } });
});
