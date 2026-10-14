// POST /api/auth/accept-invite { token, password } (workstream U-09, decision 16): an invited user sets a password with the one-time
// token the Admin handed over; the email is confirmed, so the Users table reads Active. Invalid and expired tokens answer the same
// error. No sign-in happens here: the user signs in next. Never logs the token or the password.
import { acceptInvite } from '@/lib/ct/account';
import { acceptInviteInput } from '@/lib/company/schemas';
import { handle, json, parseJson } from '@/lib/portal/route-kit';

export const POST = handle(async (request: Request) => {
  const { token, password } = await parseJson(request, acceptInviteInput);
  await acceptInvite(token, password);
  return json({ status: 'accepted' });
});
