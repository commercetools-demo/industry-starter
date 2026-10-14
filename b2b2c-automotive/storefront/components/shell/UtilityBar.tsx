// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useLocale, useTranslations } from 'next-intl';
import { isAppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { marketLabel } from '@/lib/store/format';
import type { PickupOption, StoreSettings } from '@/lib/types';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, formatMoney } from '@/lib/utils';

interface Props {
  store: string;
  settings: StoreSettings;
  /** The pickup promise of the current branch; absent when the store has no branch. */
  pickup?: { option: PickupOption; branchName: string };
}

/**
 * The black bar above the header, rendered from configuration: pickup promise of the current branch, free-shipping threshold
 * (only on a page whose currency is the threshold's currency), the market ("Deutschland (EUR €)"), Help and Track links.
 */
export function UtilityBar({ store, settings, pickup }: Props) {
  const t = useTranslations('shell.utilityBar');
  const raw = useLocale();
  const locale = isAppLocale(raw) ? raw : DEFAULT_LOCALE.locale;
  const { currency } = COUNTRY_CONFIG[locale];
  const showThreshold = settings.freeShippingThresholdCent !== undefined && (!settings.currency || settings.currency === currency);
  const pickupText = pickup
    ? pickup.option === 'today'
      ? t('pickupToday', { branch: pickup.branchName })
      : pickup.option === 'tomorrow'
        ? t('pickupTomorrow', { branch: pickup.branchName })
        : t('shipToStore', { branch: pickup.branchName })
    : null;
  const linkClass = 'underline-offset-2 hover:underline';
  return (
    <div className="bg-surface-utility text-text-on-dark">
      <div aria-label={t('label')} role="region" className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-5 gap-y-1 px-4 py-2 font-utility text-xs">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {pickupText ? <li>{pickupText}</li> : null}
          {showThreshold ? <li>{t('freeShipping', { amount: formatMoney(settings.freeShippingThresholdCent!, currency, locale) })}</li> : null}
        </ul>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <li>{marketLabel(locale)}</li>
          {settings.helpUrl ? (
            <li>
              <ExternalOrLocal href={settings.helpUrl} store={store} className={linkClass}>
                {t('help')}
              </ExternalOrLocal>
            </li>
          ) : null}
          {settings.trackUrl ? (
            <li>
              <ExternalOrLocal href={settings.trackUrl} store={store} className={linkClass}>
                {t('track')}
              </ExternalOrLocal>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

/** Settings links are absolute URLs (opened in place) or store-relative paths such as `/help`. */
function ExternalOrLocal({ href, store, className, children }: { href: string; store: string; className: string; children: React.ReactNode }) {
  if (href.startsWith('/')) {
    return (
      <Link href={`/${store}${href}`} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} rel="noopener noreferrer">
      {children}
    </a>
  );
}
