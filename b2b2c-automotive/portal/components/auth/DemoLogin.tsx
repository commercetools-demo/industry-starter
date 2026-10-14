'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { fieldClass, secondaryButtonClass } from '@/components/portal/AuthCard';
import { useHardNavigate } from '@/hooks/useHardNavigate';
import { authApi, useDemoAccounts } from '@/hooks/useAuthApi';
import type { DemoAccount } from '@/lib/portal/types';

/** Accounts grouped by business unit, in the order the server sent them (business unit, then Admin before Buyer). */
export function groupAccounts(accounts: DemoAccount[]): Array<{ group: string; accounts: DemoAccount[] }> {
  const groups: Array<{ group: string; accounts: DemoAccount[] }> = [];
  for (const account of accounts) {
    const last = groups.find((g) => g.group === account.group);
    if (last) last.accounts.push(account);
    else groups.push({ group: account.group, accounts: [account] });
  }
  return groups;
}

/**
 * Demo account picker of the sign-in card (spec design-demo-login). The server renders it only when demo login is
 * enabled; the browser sends only the account id, the password never leaves the server.
 */
export function DemoLogin() {
  const t = useTranslations('auth.demoLogin');
  const go = useHardNavigate();
  const selectId = useId();
  const { accounts, isLoading, error: loadError } = useDemoAccounts(true);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (isLoading) {
    return (
      <p role="status" className="text-body-2 font-medium text-text-subdued">
        {t('loading')}
      </p>
    );
  }
  if (loadError) return <p role="alert" className="rounded-300 bg-bg-critical-subdued px-300 py-250 text-body-2 font-semibold">{t('error')}</p>;
  if (!accounts || accounts.length === 0) {
    return <p className="text-body-2 font-medium text-text-subdued">{t('empty')}</p>;
  }

  async function signIn() {
    if (!selected) return;
    setBusy(true);
    setError(false);
    const result = await authApi.demoSignIn(selected);
    if (result.ok && result.data?.status === 'pending') go('/pending-approval');
    else if (result.ok) {
      go('/');
      return;
    } else setError(true);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-300">
      <div className="flex flex-col gap-150">
        <label htmlFor={selectId} className="text-body-2 font-semibold">
          {t('label')}
        </label>
        <select
          id={selectId}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={fieldClass}
        >
          <option value="">{t('placeholder')}</option>
          {groupAccounts(accounts).map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {error ? (
        <p id={`${selectId}-error`} role="alert" className="rounded-300 bg-bg-critical-subdued px-300 py-250 text-body-2 font-semibold">
          {t('error')}
        </p>
      ) : null}
      <button type="button" disabled={!selected || busy} onClick={signIn} className={secondaryButtonClass}>
        {busy ? t('submitting') : t('submit')}
      </button>
    </div>
  );
}
