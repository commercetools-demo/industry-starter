/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { EMERGENCY_HREF, EMERGENCY_NUMBER, ROUTES } from '@/lib/site';
import { LocaleSwitch } from './LocaleSwitch';
import { PortalButton } from './PortalButton';

export function TopBar() {
  const t = useTranslations('chrome');
  return (
    <aside className="top" aria-label={t('topBarLabel')}>
      <div className="wrap">
        <span>{t('emergency')} <b><a href={EMERGENCY_HREF}>{EMERGENCY_NUMBER}</a></b></span>
        <div className="r">
          <LocaleSwitch />
          <span className="hide-sm"><PortalButton as="link" /></span>
          <Link href={ROUTES.quote} className="hide-sm">{t('requestQuote')}</Link>
        </div>
      </div>
    </aside>
  );
}
