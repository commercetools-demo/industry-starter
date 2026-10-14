/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { titleOf } from '@/lib/portal/page-title';

export default function LocaleNotFound() {
  const t = useTranslations('errors');
  const common = useTranslations('common');
  return (
    <main className="grid min-h-screen place-items-center bg-bg-page p-800">
      <section className="w-full max-w-widget-desktop-4col rounded-400 bg-bg-surface p-800 shadow-card">
        <h1 className="text-h5 font-semibold text-text">{t('notFoundTitle')}</h1>
        <p className="mt-200 text-body-2 text-text-subdued">{t('notFoundBody')}</p>
        <Link href="/" className="mt-400 inline-block rounded-300 bg-bg-brand px-400 py-200 text-button-2 font-medium text-text-on hover:bg-bg-brand-hover">
          {common('backHome')}
        </Link>
      </section>
    </main>
  );
}

export const generateMetadata = titleOf(['errors', 'notFoundTitle']);
