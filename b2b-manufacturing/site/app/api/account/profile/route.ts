import { handle, ok, parseBody, requireCustomer } from '@/lib/api';
import { profileSchema } from '@/lib/schemas';
import { updateProfile } from '@/lib/ct/profile';
import { getSession, saveSession } from '@/lib/session';
import { setCustomer } from '@/lib/session-core';

export const PATCH = handle(async (request: Request) => {
  const session = await requireCustomer();
  const input = await parseBody(request, profileSchema);
  const saved = await updateProfile(session.customerId, input);
  await saveSession(setCustomer(await getSession(), { customerId: session.customerId, customerEmail: session.customerEmail ?? '', customerFirstName: saved.firstName, customerLastName: saved.lastName }));
  return ok({ firstName: saved.firstName, lastName: saved.lastName });
});
