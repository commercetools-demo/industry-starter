// GET /api/company/roles (workstream U-09): exactly the two roles a user can be invited as, Admin and Buyer. The project's sample
// roles (for example `approver`) are never offered.
import { listRoles } from '@/lib/ct/company';
import { companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const GET = companyHandle(async () => {
  await companyContext('company.view');
  return json({ roles: listRoles() });
});
