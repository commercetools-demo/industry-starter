// GET /api/business-units: the associate's units with the stores each can use (R-10).
import { handle, json, requireCustomer } from '@/lib/portal/route-kit';
import { getPorts, readSession } from '@/lib/portal/seam';
import { ApiError } from '@/lib/portal/route-kit';
import type { UnitsResponse } from '@/lib/portal/types';

export const GET = handle(async () => {
  const session = await readSession();
  requireCustomer(session);
  if (!session.businessUnitKey || !session.storeKey || session.pending) throw new ApiError(400, 'No active business unit');
  const units = await getPorts().listUnits(session);
  const body: UnitsResponse = { current: { businessUnitKey: session.businessUnitKey, storeKey: session.storeKey }, units };
  return json(body);
});
