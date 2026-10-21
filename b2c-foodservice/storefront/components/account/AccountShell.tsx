import type { ReactNode } from 'react';
import AccountHeader from '@/components/account/AccountHeader';
import AccountTabs from '@/components/account/AccountTabs';

/**
 * The account frame: header, then a 220px tab list beside the panel (one column under 900px). No `<main>`: the locale
 * layout owns it. Each panel loads and fails on its own.
 */
export default function AccountShell({
  firstName,
  collection,
  children,
}: {
  firstName: string;
  collection: boolean;
  children: ReactNode;
}) {
  return (
    <div className="wrap pb-20">
      <AccountHeader firstName={firstName} collection={collection} />
      <div className="grid grid-cols-1 items-start gap-6 stack:grid-cols-[220px_1fr] stack:gap-10">
        <AccountTabs collection={collection} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
