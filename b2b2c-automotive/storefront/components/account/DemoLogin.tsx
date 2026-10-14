// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { INPUT_CLASS } from '@/components/ui/Field';
import { useDemoLogin } from '@/hooks/useDemoLogin';
import { useRouter } from '@/i18n/routing';

/**
 * The demo shopper picker below the sign-in form (`consumer-storefront/design-demo-login`): a labelled native select of the store's seeded demo
 * shoppers and one button, disabled until a shopper is chosen. Only the chosen id is sent; the server signs in with the demo password it holds.
 * Loading, empty ("Run the seed") and error states are announced. Rendered only when demo login is enabled (the slot decides on the server).
 */
export function DemoLogin({ store, next }: { store: string; next: string }) {
  const t = useTranslations('account.demoLogin');
  const router = useRouter();
  const { accounts, isLoading, error, signIn } = useDemoLogin();
  const [chosen, setChosen] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;

  // A 404 means demo login is off: nothing is rendered (no trace of the control).
  if (error && !accounts) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosen || pending) return;
    setPending(true);
    setFailed(false);
    try {
      await signIn(chosen);
      router.replace(`/${store}${next === '/' ? '' : next}`);
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3 border-t border-border pt-5">
      <h2 className="m-0 font-display text-md font-semibold text-text">
        {t('title')}
      </h2>
      {isLoading || !accounts ? (
        <p role="status" className="m-0 font-ui text-sm text-text-muted">
          {t('loading')}
        </p>
      ) : accounts.length === 0 ? (
        <p role="status" className="m-0 font-ui text-sm text-text-muted">
          {t('empty')}
        </p>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-select`} className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">
              {t('label')}
            </label>
            <select id={`${id}-select`} value={chosen} onChange={(e) => setChosen(e.target.value)} aria-describedby={failed ? errorId : undefined} className={INPUT_CLASS}>
              <option value="">{t('placeholder')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          {failed ? (
            <p id={errorId} role="alert" className="m-0 rounded-sm bg-danger-50 p-3 font-ui text-sm text-danger-600">
              {t('error')}
            </p>
          ) : null}
          <button type="submit" disabled={!chosen || pending} className={buttonClass('secondary', 'w-full')}>
            {pending ? t('signingIn') : t('button')}
          </button>
        </form>
      )}
    </div>
  );
}
