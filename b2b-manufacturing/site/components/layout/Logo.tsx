/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export function Logo({ subline = true }: { subline?: boolean }) {
  const t = useTranslations('chrome');
  return (
    <Link className="logo" href="/">
      <i aria-hidden="true" />Malva {subline ? <small>{t('logoSubline')}</small> : null}
    </Link>
  );
}
