'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Dialog } from '@/components/portal/Dialog';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSecondary, errorNote, inputClass, infoNote, selectClass, successNote } from '@/components/portal/kit';
import { useCompanyActions, useCompanyRoles } from '@/hooks/companyApi';
import { failureText } from '@/hooks/sellerHttp';

/**
 * Invite a user (workstream U-09, decision 16). No e-mail is sent (Q-P01): the one-time accept-invite link is shown once, with a
 * Copy button. The path comes back from the server; the origin is the portal's own.
 */
export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('company.invite');
  const { data } = useCompanyRoles();
  const { invite } = useCompanyActions();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const roles = data?.roles ?? [];
  const chosen = roleKey || roles.find((r) => r.name === 'Buyer')?.key || roles[0]?.key || '';

  function close() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setRoleKey('');
    setError('');
    setLink(null);
    setCopied(false);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError(t('required'));
      return;
    }
    setError('');
    setBusy(true);
    const result = await invite({ firstName, lastName, email, roleKey: chosen as 'mau-role-admin' | 'mau-role-buyer' });
    setBusy(false);
    if (result.ok && result.data) setLink(`${window.location.origin}${result.data.invitePath}`);
    else setError(result.status === 409 ? t('exists') : failureText(result, t('failed')));
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (link) {
    return (
      <Dialog
        open={open}
        title={t('linkTitle')}
        onClose={close}
        footer={
          <button type="button" className={buttonPrimary} onClick={close}>
            {t('done')}
          </button>
        }
      >
        <p className={successNote}>{t('created', { email })}</p>
        <label htmlFor="invite-link" className="text-body-2 font-semibold text-text">
          {t('linkLabel')}
        </label>
        <div className="flex gap-300">
          <input id="invite-link" readOnly value={link} className={inputClass} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className={buttonSecondary} onClick={copy}>
            {t('copy')}
          </button>
        </div>
        {copied ? (
          <p role="status" className="text-caption-1 font-semibold text-text-success">
            {t('copied')}
          </p>
        ) : null}
        <p className={infoNote}>{t('note')}</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      title={t('title')}
      onClose={close}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={close}>
            {t('cancel')}
          </button>
          <button type="submit" form="invite-form" className={buttonPrimary} disabled={busy}>
            {busy ? t('sending') : t('submit')}
          </button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} noValidate className="flex flex-col gap-300">
        <FormField id="invite-first" label={t('firstName')}>
          <input id="invite-first" className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
        </FormField>
        <FormField id="invite-last" label={t('lastName')}>
          <input id="invite-last" className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
        </FormField>
        <FormField id="invite-email" label={t('email')}>
          <input id="invite-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </FormField>
        <FormField id="invite-role" label={t('role')}>
          <select id="invite-role" className={selectClass} value={chosen} onChange={(e) => setRoleKey(e.target.value)}>
            {roles.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
        </FormField>
        {error ? (
          <p role="alert" className={errorNote}>
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
