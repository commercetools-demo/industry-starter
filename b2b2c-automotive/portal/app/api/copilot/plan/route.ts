// POST /api/copilot/plan { text, locale }: what the Copilot answers or proposes (R-16). Nothing is changed here; a proposed
// change comes back as `confirm` and only POST /api/copilot/apply runs it. Planning on the server keeps one registry
// (T registers its actions there) and the permission check in one place.
import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { plan } from '@/lib/portal/copilot';
import '@/lib/portal/copilot-discounts'; // registers set-discount-active (workstream T)
import { ApiError, handle, json, parseJson, requireCustomer } from '@/lib/portal/route-kit';
import { getPorts, readSession } from '@/lib/portal/seam';

const body = z.object({ text: z.string().trim().min(1).max(300), locale: z.enum(LOCALES).default('en-US') });

export const POST = handle(async (request: Request) => {
  const session = await readSession();
  requireCustomer(session);
  if (!session.businessUnitKey || session.pending) throw new ApiError(400, 'No active business unit');
  const { text, locale } = await parseJson(request, body);
  const viewer = await getPorts().loadViewer(session);
  if (!viewer) throw new ApiError(401, 'Not signed in');
  return json(plan(text, session, { roles: viewer.roles, ctPermissions: viewer.ctPermissions }, locale));
});
