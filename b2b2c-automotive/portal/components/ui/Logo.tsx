/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useTranslations } from 'next-intl';

/** The logo mark of the design: a rounded "M" tile. `tone` follows the surface it sits on. */
export function LogoMark({ tone }: { tone: 'on-dark' | 'on-light' }) {
  const t = useTranslations('shell');
  const colours = tone === 'on-dark' ? 'bg-text-on text-gray-16' : 'bg-bg-brand text-text-on';
  return (
    <span role="img" aria-label={t('logoAlt')} className={`grid size-1000 flex-none place-items-center rounded-300 text-title-1 font-bold ${colours}`}>
      M
    </span>
  );
}
