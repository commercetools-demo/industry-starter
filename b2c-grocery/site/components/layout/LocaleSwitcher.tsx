'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Segmented } from '@/components/ui/Segmented';
import { useLocaleSwitch } from '@/hooks/useLocaleSwitch';
import type { CountryConfig } from '@/lib/utils';

/** Market picker (one option per configured market); switching changes locale, currency and country together. */
export function LocaleSwitcher({ markets, className }: { markets: CountryConfig[]; className?: string }) {
  const t = useTranslations('a11y');
  const current = useLocale();
  const { switchLocale, isPending } = useLocaleSwitch();
  return (
    <Segmented
      label={t('language')}
      className={className}
      options={markets.map((market) => ({
        value: market.locale,
        label: market.locale.split('-')[0].toUpperCase(),
        disabled: isPending,
      }))}
      value={current}
      onChange={(locale) => {
        if (locale !== current) void switchLocale(locale);
      }}
    />
  );
}
