// GET /api/business-units/current: unit, store, logical roles and commercetools permissions of the signed-in associate (R-04).
import { ApiError, handle, json, requireCustomer } from '@/lib/portal/route-kit';
import { getPorts, readSession } from '@/lib/portal/seam';
import type { CurrentUnitResponse } from '@/lib/portal/types';

export const GET = handle(async () => {
  const session = await readSession();
  requireCustomer(session);
  if (!session.businessUnitKey || !session.storeKey || session.pending) throw new ApiError(401, 'Not signed in');
  const viewer = await getPorts().loadViewer(session);
  if (!viewer) throw new ApiError(401, 'Not signed in');
  const body: CurrentUnitResponse = { businessUnitKey: viewer.businessUnitKey, storeKey: viewer.storeKey, roles: viewer.roles, ctPermissions: viewer.ctPermissions };
  return json(body);
});
