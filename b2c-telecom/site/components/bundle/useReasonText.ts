/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import type { BundleIssueReason } from '@/lib/types';

/** The localized text of a reason: its own message key (J/K own `offers.reason.*`, M owns `bundle.*`), else the generic sentence. */
export function useReasonText(): (reason: BundleIssueReason) => string {
  const t = useTranslations();
  return (reason) => (t.has(reason.messageKey) ? t(reason.messageKey, reason.params) : t('bundle.blocked.generic'));
}
