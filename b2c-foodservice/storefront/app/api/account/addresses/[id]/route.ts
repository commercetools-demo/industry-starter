import { handle, jsonError, requireCustomer } from '@/lib/api';
import { readAddressRequest } from '@/lib/account/address-request';
import { changeAddress, removeAddress } from '@/lib/ct/addresses';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const ADDRESS_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * PATCH /api/account/addresses/[id] { address, makeDefault?, confirmed? } -> 200 { addresses }. 404 for an unknown address and
 * for another customer's alike; 422 and 409 as for POST.
 */
export const PATCH = handle('/api/account/addresses/[id]', async (req, ctx) => {
  const { customerId } = await requireCustomer();
  const { id } = await ctx.params;
  if (!ADDRESS_ID.test(id)) return jsonError('not_found', 404);
  const parsed = await readAddressRequest(await req.json().catch(() => null));
  if (parsed instanceof Response) return parsed;
  return Response.json({ addresses: await changeAddress(customerId, id, parsed.address, parsed.makeDefault) }, { headers: NO_STORE });
});

/**
 * DELETE /api/account/addresses/[id] -> 200 { addresses, promotedId }. When the default was deleted the policy
 * (`DEFAULT_ADDRESS_AFTER_DELETE`) names the next default in the same update; `promotedId` is null when none was promoted.
 */
export const DELETE = handle('/api/account/addresses/[id]', async (_req, ctx) => {
  const { customerId } = await requireCustomer();
  const { id } = await ctx.params;
  if (!ADDRESS_ID.test(id)) return jsonError('not_found', 404);
  return Response.json(await removeAddress(customerId, id), { headers: NO_STORE });
});
