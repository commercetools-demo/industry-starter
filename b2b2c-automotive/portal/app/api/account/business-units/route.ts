// GET /api/account/business-units (workstream U-10): for every unit of the signed-in associate, the unit's name and type, the
// associate's role(s) in it and the store ("Explicit store" or "From parent").
import { listAccountUnits } from '@/lib/ct/account';
import { companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const GET = companyHandle(async () => {
  const session = await companyContext('account.view');
  return json({ units: await listAccountUnits(session.customerId) });
});
