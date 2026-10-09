import type { ReactNode } from 'react';
import { AccountShell } from '@/components/account/AccountShell';
import { requireSessionOrPrompt } from '@/lib/require-session';

// The whole account area is per patient: never statically rendered or cached (also `Cache-Control: no-store`
// through next.config headers). The (protected) layout above already withholds the page without a session; the
// check here keeps the shell and its children from rendering if this layout is ever moved.
export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const gate = await requireSessionOrPrompt('account');
  if (!gate.signedIn) return gate.prompt;
  return <AccountShell>{children}</AccountShell>;
}
