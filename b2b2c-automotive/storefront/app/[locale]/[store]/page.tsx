// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { getTranslations, setRequestLocale } from 'next-intl/server';

// Placeholder home inside the shell (`layout.tsx`, workstream I, owns the <main> landmark). Workstream K replaces this page.
export default async function StorePlaceholder({ params }: { params: Promise<{ locale: string; store: string }> }) {
  const { locale, store } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common');
  return (
    <div className="mx-auto max-w-content p-6 text-text">
      <p className="font-utility text-sm uppercase tracking-label text-text-subtle">{t('appName')}</p>
      <h1 className="mt-2 font-display text-4xl text-brand-700">{t('placeholder', { store })}</h1>
      <div className="mt-5 rounded-md bg-surface p-5 shadow-card">
        <span className="rounded-sm bg-action px-4 py-2 font-ui text-sm text-text-on-brand">{store}</span>
      </div>
    </div>
  );
}
