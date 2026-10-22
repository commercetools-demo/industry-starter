import type { ReactNode } from 'react';
import AccountHeader from '@/components/account/AccountHeader';
import AccountTabs from '@/components/account/AccountTabs';

/**
 * The account frame: header, then a 220px tab list beside the panel (one column under 900px). No `<main>`: the locale
 * layout owns it. Each panel loads and fails on its own.
 *
 * The frame is at least one screen tall (minus the page header) so the footer starts below the fold: a panel is filled in
 * by the browser after the first paint, and a footer that is on screen when the list arrives jumps down (layout shift 0.2 on
 * a phone in Lighthouse, found by Q).
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
    <div className="wrap min-h-[calc(100svh-7rem)] pb-20" data-testid="account-frame">
      <AccountHeader firstName={firstName} collection={collection} />
      <div className="grid grid-cols-1 items-start gap-6 stack:grid-cols-[220px_1fr] stack:gap-10">
        <AccountTabs collection={collection} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
