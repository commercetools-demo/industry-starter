// GET /api/company/users (workstream U-09): the unit's users with role, status (Active or Invited) and last active. Admin and Buyer
// (read only). Goes through the as-associate chain.
import { listUsers } from '@/lib/ct/company';
import { companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const GET = companyHandle(async () => {
  const session = await companyContext('company.view');
  return json({ users: await listUsers(session) });
});
