// POST /api/seller/impersonation/exit: ends a customer session (R-15). The portal session loses `actingAs` (the seller's own `customerId`
// is untouched), and (V-06) the handoff records of this seller in the session store are marked `ended`, best effort: the storefront
// session ends by its own idle limit anyway. No request value is used: the actor and the store come from the session.
import { endShopAs } from '@/lib/ct/seller/impersonation';
import { handle, json, requireCustomer } from '@/lib/portal/route-kit';
import { readSession, writeSession } from '@/lib/portal/seam';

export const POST = handle(async () => {
  const current = await readSession();
  requireCustomer(current);
  await writeSession((session) => {
    const { actingAs: _actingAs, ...rest } = session;
    void _actingAs;
    return rest;
  });
  if (current.storeKey && current.actingAs) {
    try {
      await endShopAs(current.storeKey, current.customerId);
    } catch {
      // The record then ends with the storefront idle limit; the portal banner is already gone.
    }
  }
  return json({ status: 'exited' });
});
