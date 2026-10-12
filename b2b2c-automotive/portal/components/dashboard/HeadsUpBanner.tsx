'use client';

import { useTranslations } from 'next-intl';
import { useHeadsUp } from '@/hooks/dashboard';
import { Link } from '@/i18n/routing';

/** At most one warning banner, derived from stock. No loading placeholder and no error state: without data it simply is not there. */
export function HeadsUpBanner() {
  const t = useTranslations('dashboard');
  const { data } = useHeadsUp();
  if (!data || !data.href.startsWith('/') || data.href.startsWith('//')) return null;
  return (
    <div role="status" data-testid="heads-up" className="flex items-center justify-between gap-400 rounded-200 border border-border bg-bg-warning-subdued px-400 py-300 text-text">
      <p className="text-body-2 font-semibold">{t('headsUp.text', { count: data.count })}</p>
      <Link href={data.href} className="flex-none text-button-2 font-bold text-text underline">
        {t('headsUp.review')}
      </Link>
    </div>
  );
}
