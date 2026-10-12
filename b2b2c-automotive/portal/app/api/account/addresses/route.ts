// GET and POST /api/account/addresses (workstream U-10): the signed-in customer's personal addresses and "Add address". The
// customer is always the session's.
import { addAccountAddress, listAccountAddresses } from '@/lib/ct/account';
import { accountAddressInput } from '@/lib/company/schemas';
import { companyBody, companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const GET = companyHandle(async () => {
  const session = await companyContext('account.view');
  return json({ addresses: await listAccountAddresses(session.customerId) });
});

export const POST = companyHandle(async (request: Request) => {
  const { session, body } = await companyBody(request, 'account.edit', accountAddressInput);
  return json({ addresses: await addAccountAddress(session.customerId, body) }, { status: 201 });
});
