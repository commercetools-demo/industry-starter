'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { SendError, sendJson } from '@/lib/fetcher';
import { useAccount } from '@/hooks/useAccount';

interface Profile { firstName: string; lastName: string; jobTitle: string; phone: string }

export function SettingsForms({ initial }: { initial: Profile }) {
  const t = useTranslations('portal.settings');
  const { mutate } = useAccount();
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMsg(''); setProfileErr('');
    try {
      await sendJson('/api/account/profile', 'PATCH', Object.fromEntries(new FormData(event.currentTarget).entries()));
      await mutate();
      setProfileMsg(t('profileSaved'));
    } catch (e) { setProfileErr(e instanceof SendError ? e.message : t('failed')); }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPwMsg(''); setPwErr('');
    try {
      await sendJson('/api/account/password', 'POST', Object.fromEntries(new FormData(form).entries()));
      form.reset();
      setPwMsg(t('passwordSaved'));
    } catch (e) { setPwErr(e instanceof SendError ? e.message : t('failed')); }
  }

  return (
    <div style={{ display: 'grid', gap: 48, maxWidth: 560 }}>
      <form onSubmit={saveProfile} style={{ display: 'grid', gap: 16 }} aria-labelledby="profile-h">
        <h2 id="profile-h" style={{ font: '600 20px/1.2 var(--font-display)' }}>{t('profile')}</h2>
        <Field label={t('firstName')} name="firstName" defaultValue={initial.firstName} required autoComplete="given-name" />
        <Field label={t('lastName')} name="lastName" defaultValue={initial.lastName} required autoComplete="family-name" />
        <Field label={t('jobTitle')} name="jobTitle" defaultValue={initial.jobTitle} autoComplete="organization-title" />
        <Field label={t('phone')} name="phone" type="tel" defaultValue={initial.phone} autoComplete="tel" />
        {profileErr ? <p className="em" role="alert">{profileErr}</p> : null}
        <LiveRegion>{profileMsg}</LiveRegion>
        {profileMsg ? <p className="alert" role="presentation">{profileMsg}</p> : null}
        <div><Button type="submit">{t('saveProfile')}</Button></div>
      </form>
      <form onSubmit={savePassword} style={{ display: 'grid', gap: 16 }} aria-labelledby="pw-h">
        <h2 id="pw-h" style={{ font: '600 20px/1.2 var(--font-display)' }}>{t('passwordTitle')}</h2>
        <Field label={t('currentPassword')} name="currentPassword" type="password" required autoComplete="current-password" />
        <Field label={t('newPassword')} name="newPassword" type="password" required autoComplete="new-password" />
        {pwErr ? <p className="em" role="alert">{pwErr}</p> : null}
        <LiveRegion>{pwMsg}</LiveRegion>
        {pwMsg ? <p className="alert" role="presentation">{pwMsg}</p> : null}
        <div><Button type="submit">{t('savePassword')}</Button></div>
      </form>
    </div>
  );
}
