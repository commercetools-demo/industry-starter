// POST /api/account/addresses/[id]/default (workstream U-10): makes one of the signed-in customer's own addresses the default.
import { setDefaultAccountAddress } from '@/lib/ct/account';
import { companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const POST = companyHandle(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const session = await companyContext('account.edit');
  const { id } = await context.params;
  return json({ addresses: await setDefaultAccountAddress(session.customerId, id) });
});
