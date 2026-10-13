// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';

/** The Malva home at `/{locale}` (no store segment, no session). Placeholder: the banner, finder and category tiles come with workstream components 4.x. */
export default async function MalvaHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  return <main className="mx-auto max-w-content p-5 text-text" />;
}
