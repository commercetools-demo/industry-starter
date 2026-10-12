// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

// The fit colours are LOCKED (success and danger tints with a glyph in the text, whatever the reseller theme says); the cart only warns, never blocks (D12).
const BASE = 'inline-flex w-fit items-center gap-1 rounded-xs px-2 py-1 font-ui text-xs font-semibold bg-danger-50 text-danger-600';

/** Cart level banner: "{n} item(s) may not fit {vehicle}" with a link to fitting alternatives. Renders nothing for 0. */
export function FitWarning({ count, vehicle, alternativesHref }: { count: number; vehicle: string; alternativesHref: string }) {
  const t = useTranslations('cart.fit');
  if (count < 1) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm bg-danger-50 px-4 py-3 font-ui text-sm font-semibold text-danger-600">
      <span>
        <span aria-hidden="true">✕</span> {t('banner', { count, vehicle })}
      </span>
      <Link href={alternativesHref} className="font-utility underline underline-offset-2">
        {t('alternatives')}
      </Link>
    </div>
  );
}

/** Badge on a line that no longer fits the active vehicle. */
export function LineFitBadge({ vehicle }: { vehicle: string }) {
  const t = useTranslations('cart.fit');
  return (
    <span className={BASE}>
      <span aria-hidden="true">✕</span> {t('line', { vehicle })}
    </span>
  );
}
