import { handle, ok } from '@/lib/api';
import { clearCustomer, getSession, saveSession } from '@/lib/session';

export const POST = handle(async () => {
  await saveSession(clearCustomer(await getSession()));
  return ok({ ok: true });
});
