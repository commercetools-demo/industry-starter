// GET and PUT /api/company/profile (workstream U-09, decision 20): the unit's company profile. Everyone reads; only an Admin edits
// the display name and the contact email. Store, region and currency are "Managed by Malva". No tax id, account number, credit
// limit or terms exist (wholesale was dropped, Q-V01).
import { getProfile, updateProfile } from '@/lib/ct/company';
import { profileInput } from '@/lib/company/schemas';
import { companyBody, companyContext, companyHandle } from '@/lib/portal/company-route';
import { json } from '@/lib/portal/route-kit';

export const GET = companyHandle(async () => {
  const session = await companyContext('company.view');
  return json({ profile: await getProfile(session) });
});

export const PUT = companyHandle(async (request: Request) => {
  const { session, body } = await companyBody(request, 'company.edit', profileInput);
  return json({ profile: await updateProfile(session, body) });
});
