// GET and POST /api/company/addresses (workstream U-09): the unit's addresses (Delivery, Delivery & billing, Billing, default
// marker) and "Add address". Reads for every role, writes Admin only. Goes through the as-associate chain.
import { addAddress, listAddresses } from '@/lib/ct/company';
import { addressInput } from '@/lib/company/schemas';
import { companyBody, companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const GET = companyHandle(async () => {
  const session = await companyContext('company.view');
  return json({ addresses: await listAddresses(session) });
});

export const POST = companyHandle(async (request: Request) => {
  const { session, body } = await companyBody(request, 'company.edit', addressInput);
  return json({ addresses: await addAddress(session, body) }, { status: 201 });
});
