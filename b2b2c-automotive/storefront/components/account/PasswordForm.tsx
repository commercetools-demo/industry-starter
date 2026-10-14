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

/** Change password: current password, new password twice. The policy rule that failed is named; a wrong current password is one message. */
export function PasswordForm() {
  const t = useTranslations('account.profile');
  const problem = useProblemText();
  const { changePassword, profile } = useProfile();
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (form.next !== form.repeat) {
      setMessage({ tone: 'error', text: t('passwordMismatch') });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', repeat: '' });
      setMessage({ tone: 'success', text: t('passwordSaved') });
    } catch (failure) {
      setMessage({ tone: 'error', text: problem(failure) });
    }
    setPending(false);
  }

  return (
    <Panel title={t('passwordTitle')} titleId="profile-password">
      <form onSubmit={submit} className="grid gap-4">
        <HiddenUsername value={profile?.email} />
        <Field label={t('currentPassword')} type="password" name="current-password" autoComplete="current-password" required value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} />
        <Field label={t('newPassword')} hint={t('passwordHint')} type="password" name="new-password" autoComplete="new-password" required value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} />
        <Field label={t('confirmPassword')} type="password" name="confirm-password" autoComplete="new-password" required value={form.repeat} onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))} />
        <Notice tone={message?.tone ?? 'success'}>{message?.text ?? null}</Notice>
        <div>
          <Button type="submit" variant="secondary" disabled={pending || form.current === '' || form.next === ''}>
            {t('passwordSubmit')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
