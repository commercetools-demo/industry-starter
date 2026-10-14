// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useClaimOrder, type ClaimError } from '@/hooks/useClaimOrder';
import { useRouter } from '@/i18n/routing';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';

interface Props {
  orderNumber: string;
  store: string;
  /** The order's email, shown and never editable: the account is made for it. */
  email: string;
  token?: string;
}

const MESSAGE: Record<ClaimError, string> = { 'too-short': 'errorTooShort', 'too-common': 'errorTooCommon', failed: 'errorFailed', 'rate-limited': 'errorRate' };

/**
 * "Create account" for a guest (design: email prefilled, only a password is asked). The server registers the customer with the order's
 * email in the order's store, attaches the order and signs the shopper in; the page then refreshes into the signed-in view. Failures the
 * shopper cannot fix are one generic message. The error takes the focus and is announced.
 */
export function GuestAccountForm({ orderNumber, store, email, token }: Props) {
  const t = useTranslations('order.account');
  const router = useRouter();
  const { claim, pending } = useClaimOrder();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ClaimError | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const result = await claim({ orderNumber, store, password, token });
    if (result.ok) {
      setPassword('');
      router.refresh();
      return;
    }
    setError(result.error);
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="order-account-title" className="grid gap-3 rounded-md border border-border bg-surface p-4">
      <h2 id="order-account-title" className="m-0 font-display text-md font-semibold text-text">
        {t('title')}
      </h2>
      <p className="m-0 font-ui text-sm text-text-muted">{t('intro')}</p>
      <Field label={t('email')} type="email" name="email" value={email} readOnly autoComplete="email" />
      <Field label={t('password')} hint={t('hint')} type="password" name="new-password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} required />
      {error ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="m-0 font-ui text-sm text-danger-600">
          {t(MESSAGE[error])}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending || password.length === 0}>
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
