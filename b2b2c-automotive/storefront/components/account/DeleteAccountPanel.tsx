// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useProblemText } from '@/components/account/ProfileForm';
import { HiddenUsername, Notice, Panel } from '@/components/account/Panel';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useProfile } from '@/hooks/useProfile';
import { useRouter } from '@/i18n/routing';

/**
 * Delete account (D11): says what is removed and what stays (orders), asks for the current password and the typed word, then signs out and goes to the
 * store home. The server anonymises the account; nothing here can be undone, so the button stays off until both fields are filled.
 */
export function DeleteAccountPanel({ store }: { store: string }) {
  const t = useTranslations('account.profile');
  const problem = useProblemText();
  const router = useRouter();
  const { deleteAccount, profile } = useProfile();
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const confirmWord = t('deleteConfirmWord');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await deleteAccount(password, word);
      router.replace(`/${store}`);
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
      setPending(false);
    }
  }

  return (
    <Panel title={t('deleteTitle')} titleId="profile-delete">
      <p className="m-0 font-ui text-sm text-text-body">{t('deleteBody')}</p>
      <form onSubmit={submit} className="grid gap-4">
        <HiddenUsername value={profile?.email} />
        <Field label={t('deletePassword')} type="password" name="current-password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label={t('deleteWordLabel', { word: confirmWord })} name="confirm" autoComplete="off" required value={word} onChange={(e) => setWord(e.target.value)} />
        <Notice tone="error">{error}</Notice>
        <div>
          <Button type="submit" variant="secondary" disabled={pending || password === '' || word.trim().toLocaleUpperCase() !== confirmWord}>
            {t('deleteSubmit')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
