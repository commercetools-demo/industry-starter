// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// Language switch of the Malva header: the same page in the other locale (links, so it works without scripts). The storefront has no
// shared locale switch component yet, so this is the one.
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { LOCALES } from '@/i18n/config';

const LABEL: Record<(typeof LOCALES)[number], string> = { 'de-DE': 'DE', 'en-US': 'EN' };
const LANG: Record<(typeof LOCALES)[number], string> = { 'de-DE': 'de', 'en-US': 'en' };

export function LocaleSwitch() {
  const t = useTranslations('malva.header');
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t('localeLabel')}>
      <ul className="flex items-center gap-1 font-utility text-sm">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname}
              locale={locale}
              lang={LANG[locale]}
              aria-current={locale === current ? 'true' : undefined}
              className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded-sm px-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                locale === current ? 'bg-surface-brand-subtle text-text-strong' : 'text-text-link hover:underline'
              }`}
            >
              {LABEL[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
