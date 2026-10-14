// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';

/** The round success mark of the design (view `done`): a check in the success colours, named for screen readers. */
export function SuccessMark() {
  const t = useTranslations('order');
  return (
    <span role="img" aria-label={t('successMark')} className="flex size-7 items-center justify-center rounded-full bg-success-50 text-success-600">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}
