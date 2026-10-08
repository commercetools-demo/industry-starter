import type { ReactNode } from 'react';
import { RequireSignInForRoute } from '@/components/layout/RequireSignInForRoute';
import { getSession } from '@/lib/session';

// Every route that shows or changes patient data lives under this group (account, cart, checkout, orders,
// prescriptions lookup). Without a signed-in customer the page is not rendered at all: the sign-in prompt
// takes its place, so no patient data can be reached or even requested. The prompt links to /login?next=<this route>.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session.customerId) return <RequireSignInForRoute />;
  return children;
}
