// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';

/** Footer of the Malva level pages. Text only: the legal pages belong to each reseller, Malva level has none. */
export function MalvaFooter() {
  const t = useTranslations('malva.footer');
  const common = useTranslations('common');
  return (
    <footer className="mt-auto bg-surface-utility text-text-on-dark">
      <div className="mx-auto flex max-w-page flex-col gap-2 px-4 py-6">
        <p className="font-display text-sm font-medium">
          {common('appName')}: {t('tagline')}
        </p>
        <p className="font-ui text-xs text-text-on-dark">{t('disclaimer')}</p>
      </div>
    </footer>
  );
}
