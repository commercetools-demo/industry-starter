// POST /api/copilot/apply { actionId, params }: runs a change the user confirmed in the Copilot panel (R-16).
// The permission is re-checked here, whatever the panel showed. Unknown actions and missing permissions change nothing.
import { z } from 'zod';
import { applyConfirmed } from '@/lib/portal/copilot';
import '@/lib/portal/copilot-discounts'; // registers set-discount-active (workstream T)
import { isCopilotEnabled } from '@/lib/portal/flags';
import { ApiError, handle, json, parseJson, requireCustomer } from '@/lib/portal/route-kit';
import { getPorts, readSession } from '@/lib/portal/seam';

const body = z.object({ actionId: z.string().min(1).max(100), params: z.record(z.string(), z.string().max(500)).default({}) });

export const POST = handle(async (request: Request) => {
  const session = await readSession();
  requireCustomer(session);
  if (!isCopilotEnabled()) throw new ApiError(404, 'Not found');
  if (!session.businessUnitKey || session.pending) throw new ApiError(400, 'No active business unit');
  const { actionId, params } = await parseJson(request, body);
  const viewer = await getPorts().loadViewer(session);
  if (!viewer) throw new ApiError(401, 'Not signed in');
  const result = await applyConfirmed(actionId, params, session, { roles: viewer.roles, ctPermissions: viewer.ctPermissions });
  return json(result, { status: result.ok ? 200 : 403 });
});
