// Server-held demo credentials (R-17a): the email comes from the seeded demo associate, the password from DEMO_LOGIN_PASSWORD.
// Neither is ever returned to the browser. Returns null for an id that is not a listed demo account.
import 'server-only';
import { listDemoAssociates } from '@/lib/ct/seller/demo-accounts';

export async function listDemoAccountsEmail(customerId: string): Promise<{ email: string; password: string } | null> {
  const password = process.env.DEMO_LOGIN_PASSWORD;
  if (!password) return null;
  const account = (await listDemoAssociates()).find((a) => a.id === customerId);
  return account ? { email: account.email, password } : null;
}
