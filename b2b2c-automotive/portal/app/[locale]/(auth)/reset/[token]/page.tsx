/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { isOnscreenResetEnabled } from '@/lib/portal/flags';
import { titleOf } from '@/lib/portal/page-title';

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <ResetPasswordForm token={token} enabled={isOnscreenResetEnabled()} />;
}

export const generateMetadata = titleOf(['auth.reset', 'newTitle']);
