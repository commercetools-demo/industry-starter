import { handle, requireCustomer } from '@/lib/api';
import { readAddressRequest } from '@/lib/account/address-request';
import { addAddress, listAddresses } from '@/lib/ct/addresses';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** GET /api/account/addresses -> 200 { addresses: AppAddress[] } of the signed-in customer. 401 with no detail. */
export const GET = handle('/api/account/addresses', async () => {
  const { customerId } = await requireCustomer();
  return Response.json({ addresses: await listAddresses(customerId) }, { headers: NO_STORE });
});

/**
 * POST /api/account/addresses { address, makeDefault?, confirmed? } -> 201 { addresses }. One update adds the address, both
 * id lists and (for the default) both default pointers. 422 validation_failed with `fields`; 409 address_needs_confirmation
 * with `unresolved` and `suggestion` (nothing written until the shopper resends with `confirmed: true`).
 */
export const POST = handle('/api/account/addresses', async (req) => {
  const { customerId } = await requireCustomer();
  const parsed = await readAddressRequest(await req.json().catch(() => null));
  if (parsed instanceof Response) return parsed;
  return Response.json({ addresses: await addAddress(customerId, parsed.address, parsed.makeDefault) }, { status: 201, headers: NO_STORE });
});
