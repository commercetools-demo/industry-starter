/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePricePreview } from '@/hooks/useFinder';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';

type PriceStripProps = {
  state: ReturnType<typeof usePricePreview>;
};

/** "Due today" and "Then monthly" from the engine's preview. Pending or failed: a loading or "Price unavailable" text, never an old figure. */
export function PriceStrip({ state }: PriceStripProps): ReactElement {
  const t = useTranslations('finder.strip');
  const tb = useTranslations('bundle.summary');
  const locale = useLocale() as Locale;
  const { preview, error, loading } = state;
  return (
    <section aria-label={t('title')} aria-live="polite" aria-busy={loading} className="grid grid-cols-2 gap-4 rounded-lg bg-brand-100 p-5">
      {error ? (
        <p className="col-span-2 m-0 text-md">{t('unavailable')}</p>
      ) : loading || !preview ? (
        <p className="col-span-2 m-0 text-md text-text-muted">{t('loading')}</p>
      ) : (
        <>
          <div className="flex flex-col">
            <span className="text-sm text-text-muted">{tb('dueToday')}</span>
            <span className="font-display text-xl font-bold">{formatMoney(preview.dueToday, locale)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-text-muted">{tb('thenMonthly')}</span>
            <span className="font-display text-xl font-bold">{formatMoney(preview.thenMonthly, locale)}</span>
          </div>
        </>
      )}
    </section>
  );
}
