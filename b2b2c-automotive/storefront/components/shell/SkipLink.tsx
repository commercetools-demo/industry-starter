// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';

export const MAIN_ID = 'main-content';

/** First focusable element of every page: jumps over the utility bar, header and navigation. Visible only on focus. */
export function SkipLink() {
  const t = useTranslations('shell');
  return (
    <a
      href={`#${MAIN_ID}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:text-text-link focus:shadow-dropdown"
    >
      {t('skipToContent')}
    </a>
  );
}
