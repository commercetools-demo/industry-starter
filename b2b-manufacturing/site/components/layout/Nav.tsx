/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useTranslations } from 'next-intl';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { NavLinks } from './NavLinks';
import { QuoteListLink } from './QuoteListLink';

export function Nav() {
  const t = useTranslations('chrome');
  return (
    <nav className="main" aria-label={t('primaryNav')}>
      <div className="wrap">
        <Logo />
        <NavLinks />
        <div className="actions">
          <QuoteListLink />
          <MobileMenu />
        </div>
      </div>
    </nav>
  );
}
