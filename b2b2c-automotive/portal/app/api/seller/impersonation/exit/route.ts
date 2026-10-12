// POST /api/seller/impersonation/exit: ends a customer session (R-15). Only the session part: no commercetools call.
// V-06 extends this file to mark its impersonation record `ended`. The seller's own `customerId` is untouched throughout.
import { handle, json, requireCustomer } from '@/lib/portal/route-kit';
import { readSession, writeSession } from '@/lib/portal/seam';

export const POST = handle(async () => {
  requireCustomer(await readSession());
  await writeSession((session) => {
    const { actingAs: _actingAs, ...rest } = session;
    void _actingAs;
    return rest;
  });
  return json({ status: 'exited' });
});
