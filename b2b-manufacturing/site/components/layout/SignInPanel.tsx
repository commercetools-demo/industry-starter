/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import { useTranslations } from 'next-intl';
import { SignInForm } from '@/components/auth/SignInForm';

/** Content of the "Client portal" dialog: lead text and the sign-in form, focus on the email field. */
export function SignInPanel({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations('auth.signIn');
  return (
    <>
      <p style={{ color: 'var(--fg2)' }}>{t('lead')}</p>
      <SignInForm onDone={onNavigate} autoFocus />
    </>
  );
}
