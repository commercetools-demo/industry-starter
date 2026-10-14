// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * Footer: seller statement, legal links and the fitment disclaimer. An application component, so Puck cannot remove the
 * disclaimer or the legal links. Styled by the theme tokens only.
 */
export function Footer({ store, storeName }: { store: string; storeName: string }) {
  const t = useTranslations('shell.footer');
  const link = 'inline-flex min-h-7 items-center underline-offset-2 hover:underline';
  return (
    <footer className="mt-auto bg-surface-utility text-text-on-dark">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="font-display text-sm font-medium">{t('soldBy', { store: storeName })}</p>
          <nav aria-label={t('legalLabel')}>
            <ul className="flex flex-wrap gap-x-5 font-utility text-sm">
              <li>
                <Link href={`/${store}/terms`} className={link}>
                  {t('terms')}
                </Link>
              </li>
              <li>
                <Link href={`/${store}/privacy`} className={link}>
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href={`/${store}/returns`} className={link}>
                  {t('returns')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className="font-ui text-xs text-text-on-dark">{t('fitmentDisclaimer')}</p>
      </div>
    </footer>
  );
}
