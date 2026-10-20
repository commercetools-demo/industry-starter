/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import { useTranslations } from 'next-intl';
import { LinkButton, type ButtonVariant } from '@/components/ui/Button';
import { useAccount } from '@/hooks/useAccount';
import { Link } from '@/i18n/routing';
import { ROUTES } from '@/lib/site';

/** "Intake": only for a signed-in client (per-visitor, so it resolves after hydration); renders nothing for a visitor. */
export function IntakeButton({ variant = 'outline', as = 'button', onClick }: { variant?: ButtonVariant; as?: 'button' | 'link'; onClick?: () => void }) {
  const t = useTranslations('chrome');
  const { account } = useAccount();
  if (!account) return null;
  return as === 'link'
    ? <Link href={ROUTES.intake} onClick={onClick}>{t('intake')}</Link>
    : <LinkButton variant={variant} href={ROUTES.intake} onClick={onClick}>{t('intake')}</LinkButton>;
}
