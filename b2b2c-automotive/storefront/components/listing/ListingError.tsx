// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/Button';

/** `error.tsx` of the listing routes: a failed search or price read says so and offers a retry; nothing technical is shown. */
export function ListingError({ reset }: { reset: () => void }) {
  const t = useTranslations('listing');
  return (
    <div role="alert" className="mx-auto grid max-w-content justify-items-start gap-3 p-5">
      <h1 className="m-0 font-display text-3xl font-semibold text-text">{t('errorTitle')}</h1>
      <p className="m-0 font-ui text-sm text-text-muted">{t('errorBody')}</p>
      <button type="button" onClick={reset} className={buttonClass('primary')}>
        {t('retry')}
      </button>
    </div>
  );
}
