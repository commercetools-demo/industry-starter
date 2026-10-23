import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import AccountShell from '@/components/account/AccountShell';
import { getAccountFrame } from '@/lib/auth/account-frame';
import { marketForLocale } from '@/lib/utils';

// Reads the session cookie: rendered fresh on every request.
export const dynamic = 'force-dynamic';

/**
 * The account frame around every page of the `(shell)` group (URLs are unchanged; sign-in and register stay outside).
 * No data is rendered without a valid session: for a guest the frame is skipped and each page's own
 * `requireCustomerPage('/account/<tab>')` redirects to sign-in with that exact path preserved (a layout cannot see its
 * path). The Collection tab exists only in markets with collection (US, D-035).
 */
export default async function AccountShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const frame = await getAccountFrame();
  if (!frame) return <>{children}</>;
  return (
    <AccountShell firstName={frame.firstName} collection={marketForLocale(locale).collection}>
      {children}
    </AccountShell>
  );
}
