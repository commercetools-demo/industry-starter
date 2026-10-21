'use client';

import { useLocale, useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { useShellUi } from '@/context/shell-ui-context';
import { marketForLocale } from '@/lib/utils';

/** Globe plus `US (USD) | EN`. Opens the locale chooser drawer. */
export default function LocalePill() {
  const t = useTranslations('shell.localePill');
  const market = marketForLocale(useLocale());
  const { setLocaleOpen } = useShellUi();
  const language = market.locale.split('-')[0].toUpperCase();
  const text = `${market.country} (${market.currency}) | ${language}`;
  return (
    <button
      type="button"
      onClick={() => setLocaleOpen(true)}
      aria-haspopup="dialog"
      aria-label={t('aria', { country: market.country, currency: market.currency })}
      className="transition-state inline-flex shrink-0 items-center gap-2 rounded-pill border border-transparent bg-transparent px-3 py-2 text-[13px] font-medium text-ink hover:bg-ink/6 max-[1100px]:p-2 max-[380px]:hidden"
    >
      <Icon name="globe" size={18} />
      <span className="whitespace-nowrap max-[1100px]:hidden">{text}</span>
    </button>
  );
}
