// POST /api/business-units/select { businessUnitKey, storeKey? }: switches unit and store (R-10). The unit must belong to the
// associate; the five business unit and store fields are written in one session write and cartId is cleared.
import { z } from 'zod';
import { applyBusinessContext } from '@/lib/session-core';
import { ApiError, handle, json, parseJson, requireCustomer } from '@/lib/portal/route-kit';
import { getPorts, readSession, writeSession } from '@/lib/portal/seam';

const body = z.object({ businessUnitKey: z.string().min(1), storeKey: z.string().min(1).optional() });

export const POST = handle(async (request: Request) => {
  const session = await readSession();
  requireCustomer(session);
  const { businessUnitKey, storeKey } = await parseJson(request, body);
  const ports = getPorts();
  const unit = (await ports.listUnits(session)).find((u) => u.key === businessUnitKey);
  if (!unit || (storeKey && !unit.stores.some((s) => s.key === storeKey))) throw new ApiError(404, 'Not found');
  const context = await ports.resolveContext(session, businessUnitKey, storeKey);
  if (!context) throw new ApiError(404, 'Not found');
  await writeSession((s) => applyBusinessContext(s, context));
  const store = unit.stores.find((s) => s.key === context.storeKey);
  return json(
    { businessUnitKey: context.businessUnitKey, storeKey: context.storeKey, label: `${unit.name} · ${store?.name ?? context.storeKey}`, name: unit.name },
    // The last used unit is preferred at the next sign-in (Q-R08). Not a secret.
    { headers: { 'Set-Cookie': `portal_last_bu=${encodeURIComponent(context.businessUnitKey)}; Path=/; SameSite=Lax; Max-Age=31536000` } },
  );
});
