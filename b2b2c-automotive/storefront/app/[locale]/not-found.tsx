// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function LocaleNotFound() {
  const t = await getTranslations('errors');
  const common = await getTranslations('common');
  return (
    <main className="mx-auto max-w-content p-6 text-text">
      {/* A descriptive title (WCAG 2.4.2): React hoists it to the head; a metadata export is ignored for a 404 and left "Malva". */}
      <title>{t('notFoundTitle')}</title>
      <h1 className="font-display text-3xl text-text-strong">{t('notFoundTitle')}</h1>
      <p className="mt-3 font-body text-md text-text-muted">{t('notFoundBody')}</p>
      <Link href="/" className="mt-5 inline-block font-utility text-md text-text-link underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {common('backHome')}
      </Link>
    </main>
  );
}
