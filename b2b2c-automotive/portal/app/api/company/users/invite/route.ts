// POST /api/company/users/invite { email, firstName, lastName, roleKey } (workstream U-09, decision 16): Admin only. Creates the
// customer, adds the associate with the chosen role (Admin or Buyer) and returns the one-time accept-invite path ONCE. No email
// is sent (Q-P01); the path is never stored or logged.
import { inviteUser, toInviteResult } from '@/lib/ct/company';
import { inviteInput } from '@/lib/company/schemas';
import { companyBody, companyHandle } from '@/lib/portal/company-route';
import { localeOf } from '@/lib/portal/auth-session';
import { json } from '@/lib/portal/route-kit';

export const POST = companyHandle(async (request: Request) => {
  const { session, body } = await companyBody(request, 'company.edit', inviteInput);
  const { token, user } = await inviteUser(session, body);
  return json(toInviteResult(token, user, localeOf(request)), { status: 201 });
});
