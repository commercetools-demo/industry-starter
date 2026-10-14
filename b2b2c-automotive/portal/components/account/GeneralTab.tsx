/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, cardClass, errorNote, inputClass, sectionTitle, successNote } from '@/components/portal/kit';
import { useAccountActions, useAccountProfile } from '@/hooks/accountApi';
import { failureText } from '@/hooks/sellerHttp';
import type { AccountProfile } from '@/lib/company/types';

/** Account > General: the signed-in customer's own name and email. A duplicate email answers 409. */
export function GeneralTab() {
  const t = useTranslations('account.general');
  const { data, error, isLoading } = useAccountProfile();
  const profile = data?.profile;
  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="general-title">
      <h2 id="general-title" className={sectionTitle}>
        {t('title')}
      </h2>
      {error ? (
        <p role="alert" className={errorNote}>
          {t('loadFailed')}
        </p>
      ) : null}
      {isLoading || !profile ? (
        <p role="status" className="text-body-2 text-text-subdued">
          {t('loading')}
        </p>
      ) : (
        <GeneralForm profile={profile} />
      )}
    </section>
  );
}

function GeneralForm({ profile }: { profile: AccountProfile }) {
  const t = useTranslations('account.general');
  const { saveProfile } = useAccountActions();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await saveProfile({ firstName, lastName, email });
    setBusy(false);
    if (result.ok) setMessage({ tone: 'ok', text: t('saved') });
    else setMessage({ tone: 'error', text: result.status === 409 ? t('emailInUse') : failureText(result, t('failed')) });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-widget-desktop-4col flex-col gap-300">
      <FormField id="acc-first" label={t('firstName')}>
        <input id="acc-first" className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
      </FormField>
      <FormField id="acc-last" label={t('lastName')}>
        <input id="acc-last" className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
      </FormField>
      <FormField id="acc-email" label={t('email')}>
        <input id="acc-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </FormField>
      {message ? (
        <p role={message.tone === 'ok' ? 'status' : 'alert'} className={message.tone === 'ok' ? successNote : errorNote}>
          {message.text}
        </p>
      ) : null}
      <div>
        <button type="submit" className={buttonPrimary} disabled={busy}>
          {busy ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
