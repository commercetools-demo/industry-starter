// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  const common = useTranslations('common');
  return (
    <main className="mx-auto max-w-content p-6 text-text">
      <h1 className="font-display text-3xl text-text-strong">{t('genericTitle')}</h1>
      <p className="mt-3 font-body text-md text-text-muted">{t('genericBody')}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-sm bg-action px-5 py-3 font-display text-md text-text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {common('tryAgain')}
      </button>
    </main>
  );
}
