'use client';

import { useTranslations } from 'next-intl';
import { useAccountSummary } from '@/hooks/useAccountSummary';

/**
 * Eyebrow, greeting and one status line. Each count is its own panel: a count that failed reads "Orders unavailable", a
 * zero reads "No open orders", and the other count still shows. No loyalty or membership text (Q-L-06).
 */
export default function AccountHeader({ firstName, collection }: { firstName: string; collection: boolean }) {
  const t = useTranslations('account');
  const { summary, isLoading, isError } = useAccountSummary();

  const parts: string[] = [];
  if (isLoading) {
    parts.push(t('panel.loading'));
  } else {
    const open = isError ? null : (summary?.openOrders ?? null);
    const ready = isError ? null : (summary?.readyForCollection ?? null);
    parts.push(open === null ? t('status.unavailable') : open === 0 ? t('status.openNone') : t('status.open', { count: open }));
    if (collection && ready !== null && ready > 0) parts.push(t('status.ready', { count: ready }));
  }

  return (
    <header className="pb-6 pt-7">
      <p className="eyebrow m-0">{t('eyebrow')}</p>
      <h1 className="page-title m-0 mt-1.5">{firstName ? t('greeting', { first: firstName }) : t('greetingNoName')}</h1>
      <p className="m-0 mt-2 text-[14px] text-ink-3" role="status" data-testid="account-status">
        {parts.join(' · ')}
      </p>
    </header>
  );
}
