/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useTranslations } from 'next-intl';
import { AuthCard } from '@/components/portal/AuthCard';
import { SignOutButton } from './SignOutButton';

/** Status page of a registered business that Malva has not activated yet: static text, the business name, Sign out. Polls nothing. */
export function PendingApproval({ businessName }: { businessName?: string }) {
  const t = useTranslations('auth.pending');
  return (
    <AuthCard title={t('title')} subtitle={t('subtitle')}>
      <p className="text-body-1 font-medium">{businessName ? t('body', { business: businessName }) : t('bodyNoName')}</p>
      <SignOutButton />
    </AuthCard>
  );
}
