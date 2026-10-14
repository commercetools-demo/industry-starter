/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { SignInClient } from './SignInClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.signIn' });
  return { title: t('pageTitle'), robots: { index: false } };
}

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.signIn');
  return (
    <AuthPageShell title={t('title')} lead={t('lead')}>
      <Suspense fallback={null}><SignInClient /></Suspense>
    </AuthPageShell>
  );
}
