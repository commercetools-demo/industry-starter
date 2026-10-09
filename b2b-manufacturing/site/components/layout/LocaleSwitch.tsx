'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { COUNTRY_CONFIG } from '@/lib/utils';

/** Same page under the other locale (slug unchanged). The write of locale, currency and country is fired as the link is followed. */
export function LocaleSwitch() {
  const current = useLocale();
  const pathname = usePathname();
  const t = useTranslations('chrome');
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return (
    <span className="lang" role="group" aria-label={t('language')}>
      {Object.values(COUNTRY_CONFIG).map(({ locale, label }) => (
        <Link
          key={locale}
          href={`${pathname}${search}`}
          locale={locale}
          lang={locale}
          hrefLang={locale}
          aria-current={locale === current ? 'true' : undefined}
          onClick={() => { void fetch('/api/locale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale }), keepalive: true }).catch(() => undefined); }}
        >
          {label}
        </Link>
      ))}
    </span>
  );
}
