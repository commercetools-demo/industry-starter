/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { setRequestLocale } from 'next-intl/server';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { titleOf } from '@/lib/portal/page-title';

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RegisterForm />;
}

export const generateMetadata = titleOf(['auth.register', 'title']);
