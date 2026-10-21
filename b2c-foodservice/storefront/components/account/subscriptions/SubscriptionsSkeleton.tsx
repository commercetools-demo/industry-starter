'use client';

import { useTranslations } from 'next-intl';

export default function SubscriptionsSkeleton() {
  const t = useTranslations('account.panel');
  return (
    <ul className="m-0 grid list-none gap-3 p-0" aria-busy="true" aria-label={t('loading')} data-testid="subscriptions-loading">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-[136px] animate-pulse rounded-card bg-canvas-2" />
      ))}
    </ul>
  );
}
