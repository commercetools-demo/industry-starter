'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormField } from '@/components/portal/FormField';
import { cardClass, errorNote, inputClass, infoNote, sectionTitle, successNote } from '@/components/portal/kit';
import { PermissionButton } from '@/components/portal/PermissionButton';
import { useCompanyActions, useCompanyProfile } from '@/hooks/companyApi';
import { usePermissions } from '@/hooks/usePermissions';
import { failureText } from '@/hooks/sellerHttp';
import type { ProfileView } from '@/lib/company/types';

/** Company profile (reduced after Q-V01, decision 20): name and contact email editable by an Admin; the rest is "Managed by Malva". */
export function ProfileTab() {
  const t = useTranslations('company.profile');
  const { data, error, isLoading } = useCompanyProfile();
  const profile = data?.profile;
  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="profile-title">
      <div>
        <h2 id="profile-title" className={sectionTitle}>
          {t('title')}
        </h2>
        <p className="text-body-2 text-text-subdued">{t('subtitle')}</p>
      </div>
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
        <ProfileForm profile={profile} />
      )}
    </section>
  );
}

function ProfileForm({ profile }: { profile: ProfileView }) {
  const t = useTranslations('company.profile');
  const { saveProfile } = useCompanyActions();
  const { can } = usePermissions();
  const allowed = can('company.edit');
  const [name, setName] = useState(profile.name);
  const [contactEmail, setContactEmail] = useState(profile.contactEmail);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!allowed) return;
    setBusy(true);
    setMessage(null);
    const result = await saveProfile({ name, contactEmail });
    setBusy(false);
    setMessage(result.ok ? { tone: 'ok', text: t('saved') } : { tone: 'error', text: failureText(result, t('failed')) });
  }

  const managed = (id: string, label: string, value: string) => (
    <FormField id={id} label={label} hint={t('managed')}>
      <input id={id} readOnly value={value} className={inputClass} />
    </FormField>
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-widget-desktop-4col flex-col gap-300">
      <FormField id="company-name" label={t('name')}>
        <input id="company-name" className={inputClass} value={name} readOnly={!allowed} disabled={!allowed} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField id="company-email" label={t('contactEmail')}>
        <input id="company-email" type="email" className={inputClass} value={contactEmail} readOnly={!allowed} disabled={!allowed} onChange={(e) => setContactEmail(e.target.value)} />
      </FormField>
      {managed('company-kind', t('kind'), profile.kind)}
      {managed('company-store', t('store'), `${profile.storeName} (${profile.storeKey})`)}
      {managed('company-region', t('region'), profile.region)}
      {managed('company-currency', t('currency'), profile.currency)}
      {allowed ? null : <p className={infoNote}>{t('contactAdmin')}</p>}
      {message ? (
        <p role={message.tone === 'ok' ? 'status' : 'alert'} className={message.tone === 'ok' ? successNote : errorNote}>
          {message.text}
        </p>
      ) : null}
      <div>
        <PermissionButton action="company.edit" type="submit" disabled={busy}>
          {busy ? t('saving') : t('save')}
        </PermissionButton>
      </div>
    </form>
  );
}
