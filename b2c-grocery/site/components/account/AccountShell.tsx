'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAccount } from '@/hooks/useAccount';
import { useProfile } from '@/hooks/useOrders';

/**
 * The dashboard frame: kicker "Member since {year}" (from the profile), the customer name as H1 (from the session user,
 * so it shows immediately) and the 1.6fr / 1fr grid at `desktop`, one column below. Cards come first on narrow screens.
 */
export function AccountShell({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  const t = useTranslations('account');
  const { user } = useAccount();
  const { profile } = useProfile();
  const first = profile?.firstName ?? user?.firstName ?? '';
  const last = profile?.lastName ?? user?.lastName ?? '';
  const name = `${first} ${last}`.trim() || (profile?.email ?? user?.email ?? '');
  // UTC like every date in the account area: the year never depends on the browser's time zone.
  const year = profile ? new Date(profile.createdAt).getUTCFullYear() : null;
  return (
    <div className="page py-[calc(var(--space-8)*1.2)] px-(--space-4) tablet:px-(--space-8)">
      {year ? <h6 className="text-accent-700">{t('memberSince', { year })}</h6> : null}
      <h1 className="mb-(--space-6) text-[52px]">{name}</h1>
      <div className="grid items-start gap-[42px] desktop:grid-cols-[1.6fr_1fr]">
        <div className="order-2 desktop:order-1">{main}</div>
        <aside className="order-1 flex flex-col gap-(--space-4) desktop:order-2">{aside}</aside>
      </div>
    </div>
  );
}
