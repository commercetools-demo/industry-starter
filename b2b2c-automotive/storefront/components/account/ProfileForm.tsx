// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Notice, PageTitle, Panel, StateMessage } from '@/components/account/Panel';
import { MarketingConsentCheckbox } from '@/components/auth/MarketingConsentCheckbox';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { errorCodeOf, errorRuleOf } from '@/hooks/account-fetch';
import { useProfile } from '@/hooks/useProfile';

const KNOWN = ['wrong-password', 'email-update-failed', 'confirm-word', 'rate-limited'];

/** Account error to words: a known code, or the generic message. */
export function useProblemText() {
  const te = useTranslations('account.profile.errors');
  const rules = useTranslations('account.passwordRules');
  return (failure: unknown): string => {
    const code = errorCodeOf(failure);
    if (code === 'weak-password') {
      const rule = errorRuleOf(failure);
      return rule === 'too-short' || rule === 'too-common' ? rules(rule) : te('generic');
    }
    return KNOWN.includes(code) ? te(code as 'wrong-password') : te('generic');
  };
}

/**
 * The profile page: names and mobile (Save), the marketing consent (a toggle that saves at once and announces it; never pre-checked, the date is
 * written by the server), and the email change (asks for the current password). The password and delete forms follow on the page.
 */
export function ProfileForm() {
  const t = useTranslations('account.profile');
  const tc = useTranslations('account');
  const problem = useProblemText();
  const { profile, isLoading, error, reload, save, changeEmail } = useProfile();
  // Edits live in `draft` on top of the saved profile, so nothing has to be copied into state when the profile arrives.
  const [draft, setDraft] = useState<{ firstName?: string; lastName?: string; mobile?: string }>({});
  const form = { firstName: draft.firstName ?? profile?.firstName ?? '', lastName: draft.lastName ?? profile?.lastName ?? '', mobile: draft.mobile ?? profile?.mobile ?? '' };
  const [consentStatus, setConsentStatus] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState({ newEmail: '', currentPassword: '' });
  const [emailMessage, setEmailMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await save({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), mobile: form.mobile.trim() });
      setDraft({});
      setMessage({ tone: 'success', text: t('saved') });
    } catch (failure) {
      setMessage({ tone: 'error', text: problem(failure) });
    }
    setPending(false);
  }

  async function toggleConsent(checked: boolean) {
    setConsentStatus(tc('saving'));
    try {
      await save({ marketingConsent: checked });
      setConsentStatus(t('saved'));
    } catch {
      setConsentStatus(t('errors.generic'));
    }
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setEmailMessage(null);
    try {
      await changeEmail(email.newEmail.trim(), email.currentPassword);
      setEmail({ newEmail: '', currentPassword: '' });
      setEmailMessage({ tone: 'success', text: t('emailSaved') });
    } catch (failure) {
      setEmailMessage({ tone: 'error', text: problem(failure) });
    }
  }

  if (isLoading && !profile)
    return (
      <div className="grid gap-5">
        <PageTitle>{t('title')}</PageTitle>
        <StateMessage kind="loading" />
      </div>
    );
  if (error || !profile)
    return (
      <div className="grid gap-5">
        <PageTitle>{t('title')}</PageTitle>
        <StateMessage kind="error" onRetry={() => void reload()} />
      </div>
    );

  return (
    <div className="grid gap-5">
      <PageTitle>{t('title')}</PageTitle>
      <Panel title={t('personalTitle')} titleId="profile-personal">
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 min-[43.75rem]:grid-cols-2">
            <Field label={t('firstName')} name="given-name" autoComplete="given-name" value={form.firstName} onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))} />
            <Field label={t('lastName')} name="family-name" autoComplete="family-name" value={form.lastName} onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))} />
          </div>
          <Field label={t('mobile')} hint={t('mobileHint')} name="tel" type="tel" autoComplete="tel" inputMode="tel" value={form.mobile} onChange={(e) => setDraft((d) => ({ ...d, mobile: e.target.value }))} />
          <div className="grid gap-1">
            <span className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('email')}</span>
            <span className="font-ui text-sm text-text">{profile.email}</span>
          </div>
          <Notice tone={message?.tone ?? 'success'}>{message?.text ?? null}</Notice>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? tc('saving') : tc('save')}
            </Button>
          </div>
        </form>
        <div className="grid gap-2 border-t border-border pt-4">
          <MarketingConsentCheckbox checked={profile.marketingConsent} onChange={toggleConsent} status={consentStatus} />
          <p className="m-0 font-ui text-xs text-text-subtle">{t('consentNote')}</p>
        </div>
      </Panel>
      <Panel title={t('emailTitle')} titleId="profile-email">
        <form onSubmit={submitEmail} className="grid gap-4">
          <Field label={t('newEmail')} type="email" name="email" autoComplete="email" inputMode="email" required value={email.newEmail} onChange={(e) => setEmail((s) => ({ ...s, newEmail: e.target.value }))} />
          <Field label={t('currentPassword')} type="password" name="current-password" autoComplete="current-password" required value={email.currentPassword} onChange={(e) => setEmail((s) => ({ ...s, currentPassword: e.target.value }))} />
          <Notice tone={emailMessage?.tone ?? 'success'}>{emailMessage?.text ?? null}</Notice>
          <div>
            <Button type="submit" variant="secondary" disabled={email.newEmail.trim() === '' || email.currentPassword === ''}>
              {t('emailSubmit')}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
