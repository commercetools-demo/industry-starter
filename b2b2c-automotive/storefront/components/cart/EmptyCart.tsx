// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';

/** Dashed panel: "Your cart is empty." and Browse parts. The summary is not rendered when this shows. */
export function EmptyCart({ browseHref }: { browseHref: string }) {
  const t = useTranslations('cart');
  return (
    <div className="grid justify-items-center gap-4 rounded-md border border-dashed border-border-strong bg-surface p-7 text-center">
      <p className="m-0 font-ui text-md text-text-muted">{t('empty')}</p>
      <Link href={browseHref} className={buttonClass('primary')}>
        {t('browse')}
      </Link>
    </div>
  );
}
