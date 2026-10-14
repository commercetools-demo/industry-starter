/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { setRequestLocale } from 'next-intl/server';
import { ResetRequestForm } from '@/components/auth/ResetRequestForm';
import { isOnscreenResetEnabled } from '@/lib/portal/flags';
import { titleOf } from '@/lib/portal/page-title';

export default async function ResetRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // With DEMO_ONSCREEN_RESET off the page shows no reset form (the routes answer 404 as well).
  return <ResetRequestForm enabled={isOnscreenResetEnabled()} />;
}

export const generateMetadata = titleOf(['auth.reset', 'title']);
