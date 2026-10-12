'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, cardClass, errorNote, inputClass, sectionTitle, successNote } from '@/components/portal/kit';
import { useAccountActions } from '@/hooks/accountApi';
import { failureText } from '@/hooks/sellerHttp';
import { checkPassword } from '@/lib/account/password-check';

/**
 * Account > Security (decision 19): live password feedback ("Enter a new password", "Too short", "Passwords don't match", "Looks good");
 * Update password reports "Fix the password first" while the new password is not valid. Wrong current password: 400.
 */
export function SecurityTab() {
  const t = useTranslations('account.security');
  const { changePassword } = useAccountActions();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const state = checkPassword(next, repeat);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state !== 'ok') {
      setMessage({ tone: 'error', text: t('fixFirst') });
      return;
    }
    if (!current) {
      setMessage({ tone: 'error', text: t('currentRequired') });
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await changePassword(current, next);
    setBusy(false);
    if (result.ok) {
      setCurrent('');
      setNext('');
      setRepeat('');
      setMessage({ tone: 'ok', text: t('changed') });
    } else {
      setMessage({ tone: 'error', text: result.status === 400 ? t('wrongCurrent') : failureText(result, t('failed')) });
    }
  }

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="security-title">
      <div>
        <h2 id="security-title" className={sectionTitle}>
          {t('title')}
        </h2>
        <p className="text-body-2 text-text-subdued">{t('subtitle')}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex max-w-widget-desktop-4col flex-col gap-300">
        <FormField id="sec-current" label={t('current')}>
          <input id="sec-current" type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </FormField>
        <FormField id="sec-new" label={t('new')}>
          <input id="sec-new" type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
        </FormField>
        <FormField id="sec-repeat" label={t('repeat')}>
          <input id="sec-repeat" type="password" autoComplete="new-password" className={inputClass} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </FormField>
        <p role="status" aria-live="polite" className={`text-caption-1 font-semibold ${state === 'ok' ? 'text-text-success' : 'text-text-subdued'}`}>
          {t(`state.${state}`)}
        </p>
        {message ? (
          <p role={message.tone === 'ok' ? 'status' : 'alert'} className={message.tone === 'ok' ? successNote : errorNote}>
            {message.text}
          </p>
        ) : null}
        <div>
          <button type="submit" className={buttonPrimary} disabled={busy}>
            {busy ? t('updating') : t('update')}
          </button>
        </div>
      </form>
    </section>
  );
}
