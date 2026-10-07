import type { ReactElement } from 'react';
import { AccountLink } from '@/components/layout/AccountLink';
import { getAccountFirstName } from '@/lib/ct/account-name';
import { getSession } from '@/lib/ct/session';

// Per buyer: reads the signed cookie on every request. Never cached, never wrapped in unstable_cache (the shared category tree is).
export async function AccountSlot(): Promise<ReactElement> {
  const session = await getSession();
  if (!session.customerId) return <AccountLink signedIn={false} />;
  return <AccountLink signedIn firstName={await getAccountFirstName(session.customerId)} />;
}
