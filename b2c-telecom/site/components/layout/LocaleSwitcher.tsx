'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING_ON_BRAND } from '@/components/ui/focus';
import { useToast } from '@/components/ui/Toast';
import { useSwitchMarket } from '@/hooks/useSwitchMarket';
import { cx } from '@/lib/cx';
import { COUNTRY_CONFIG, LOCALES, type Market } from '@/lib/utils';

/**
 * Language and region switch (undrawn, D-068: Junior design choice): two pill buttons "EN" / "DE" in a labelled group.
 * The current one is the dark pill and `aria-pressed`. D's hook does the POST /api/locale and the route change;
 * this component only shows the toast the hook's result asks for.
 */
export function LocaleSwitcher({ current, className }: { current: Market['locale']; className?: string }): ReactElement {
  const t = useTranslations('shell.locale');
  const tRegion = useTranslations('region');
  const { switchMarket, pending } = useSwitchMarket();
  const toast = useToast();

  async function choose(locale: Market['locale']): Promise<void> {
    if (locale === current || pending) return;
    const market = COUNTRY_CONFIG[locale].label;
    try {
      const result = await switchMarket(locale);
      if (result.cart.action === 'discarded' && result.cart.droppedLines.length > 0) {
        toast.show({ message: tRegion('cartEmptied', { market, lines: result.cart.droppedLines.map((line) => line.name).join(', ') }) });
      } else {
        toast.show({ message: tRegion('switched', { market }) });
      }
    } catch {
      toast.show({ message: tRegion('error'), tone: 'error' });
    }
  }

  return (
    <div role="group" aria-label={t('label')} className={cx('inline-flex items-center gap-1 rounded-pill', className)}>
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-label={t(locale)}
            aria-pressed={active}
            disabled={pending}
            onClick={() => void choose(locale)}
            className={cx(
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-3 font-display text-sm font-semibold tracking-ui',
              active ? 'bg-brand-950 text-text-on-pink' : 'bg-transparent text-text-on-brand hover:bg-brand-400',
              FOCUS_RING_ON_BRAND,
            )}
          >
            {locale.slice(0, 2).toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
