// DELETE /api/account/addresses/[id] (workstream U-10): removes one of the signed-in customer's own addresses (404 for any other id).
import { removeAccountAddress } from '@/lib/ct/account';
import { companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const DELETE = companyHandle(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const session = await companyContext('account.edit');
  const { id } = await context.params;
  return json({ addresses: await removeAccountAddress(session.customerId, id) });
});
