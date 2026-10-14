// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useAccount } from '@/hooks/useAccount';
import { Link, useRouter } from '@/i18n/routing';

interface Props {
  store: string;
  storeName: string;
  /** Validated return path inside the store, without locale and store key (`/cart`, `/account/orders`; `safeNext`). */
  next: string;
}

/**
 * Email and password sign-in (workstream N; Q adds register and forgot-password links around it). One generic message for every failure:
 * it never says whether the email exists or belongs to another reseller. The error takes the focus and is announced. After success the
 * server components are refreshed (account link, cart) and the shopper goes to `next`; the anonymous cart was merged by the server.
 */
export function SignInForm({ store, storeName, next }: Props) {
  const t = useTranslations('auth.signIn');
  const router = useRouter();
  const { customer, isSignedIn, login, logout } = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<'errorInvalid' | 'errorRate' | 'errorFailed' | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await login(email.trim(), password);
    setPending(false);
    if (result.ok) {
      setPassword('');
      router.replace(`/${store}${next === '/' ? '' : next}`);
      router.refresh();
      return;
    }
    setError(result.error === 'invalid-credentials' ? 'errorInvalid' : result.error === 'rate-limited' ? 'errorRate' : 'errorFailed');
  }

  if (isSignedIn && customer) {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email;
    return (
      <div className="grid gap-4">
        <p className="m-0 font-ui text-md text-text">{t('alreadySignedIn', { name })}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/${store}`} className={buttonClass('primary')}>
            {t('continue')}
          </Link>
          <button
            type="button"
            className={buttonClass('secondary')}
            onClick={async () => {
              await logout();
              router.refresh();
            }}
          >
            {t('signOut')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-describedby="signin-intro">
      <p id="signin-intro" className="m-0 font-ui text-sm text-text-muted">
        {t('intro', { store: storeName })}
      </p>
      <Field label={t('email')} type="email" name="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <Field label={t('password')} type="password" name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      {error ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="m-0 rounded-sm bg-danger-50 p-3 font-ui text-sm text-danger-600">
          {t(error)}
        </p>
      ) : null}
      <button type="submit" disabled={pending || email.trim() === '' || password === ''} className={buttonClass('primary', 'w-full')}>
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
