'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { useTeam } from '@/hooks/useTeam';
import { SendError } from '@/lib/fetcher';
import { TEAM_ROLES, type TeamInput, type TeamMember, type TeamRoleKey } from '@/lib/portal/types';
import { TeamPasswordDialog } from './TeamPasswordDialog';

type Open = 'invite' | { remove: TeamMember } | null;

/** Team of the company with roles. Administrators add (one-time password), change roles and remove; other roles see a read-only table. */
export function TeamManager() {
  const t = useTranslations('portal.team');
  const { members, canEdit, isLoading, failed, invite, changeRole, remove } = useTeam();
  const [open, setOpen] = useState<Open>(null);
  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof SendError ? e.message : t('failed'));
    } finally {
      setBusy(false);
    }
  }

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget).entries()) as unknown as TeamInput;
    void run(async () => {
      const res = await invite(input);
      setOpen(null);
      setIssued({ name: res.member.name, password: res.temporaryPassword });
    });
  };

  return (
    <>
      <h1 style={{ marginBottom: 24 }}>{t('title')}</h1>
      {isLoading ? <p role="status">{t('loading')}</p> : null}
      {failed ? <p className="em" role="alert">{t('loadFailed')}</p> : null}
      <LiveRegion>{message}</LiveRegion>
      {message ? <p className="alert" role="presentation" style={{ marginBottom: 16 }}>{message}</p> : null}
      {error && !open ? <p className="em" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}
      {!isLoading && !failed ? (
        <>
          {canEdit ? <p style={{ marginBottom: 16 }}><Button onClick={() => { setError(''); setOpen('invite'); }}>{t('invite')}</Button></p> : <p className="hint" style={{ marginBottom: 16 }}>{t('readOnly')}</p>}
          {members.length === 0 ? <div className="card"><div className="b"><p>{t('empty')}</p></div></div> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <caption className="sr-only">{t('caption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('name')}</th><th scope="col">{t('email')}</th><th scope="col">{t('role')}</th>
                    {canEdit ? <th scope="col"><span className="sr-only">{t('actions')}</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const role = member.roleKeys[0] ?? '';
                    return (
                      <tr key={member.customerId}>
                        <td>{member.name}{member.isYou ? ` (${t('you')})` : ''}</td>
                        <td>{member.email}</td>
                        <td>
                          {canEdit ? (
                            <select aria-label={t('roleFor', { name: member.name })} value={role} disabled={busy} style={{ height: 40 }}
                              onChange={(e) => { const next = e.target.value as TeamRoleKey; void run(async () => { await changeRole(member.customerId, next); setMessage(t('roleChanged')); }); }}>
                              {!(TEAM_ROLES as readonly string[]).includes(role) ? <option value={role}>{role}</option> : null}
                              {TEAM_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                            </select>
                          ) : ((TEAM_ROLES as readonly string[]).includes(role) ? t(`roles.${role as TeamRoleKey}`) : role)}
                        </td>
                        {canEdit ? <td><Button small variant="outline" aria-label={t('removeAria', { name: member.name })} disabled={busy} onClick={() => { setError(''); setOpen({ remove: member }); }}>{t('remove')}</Button></td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      <Dialog open={open === 'invite'} onClose={() => setOpen(null)} title={t('inviteTitle')} closeLabel={t('cancel')}>
        <form onSubmit={submitInvite} style={{ display: 'grid', gap: 16 }}>
          <p className="hint">{t('inviteHint')}</p>
          <Field label={t('firstName')} name="firstName" required maxLength={100} autoComplete="off" />
          <Field label={t('lastName')} name="lastName" required maxLength={100} autoComplete="off" />
          <Field label={t('workEmail')} name="email" type="email" required maxLength={254} autoComplete="off" />
          <Field as="select" label={t('roleLabel')} name="roleKey" defaultValue="mpw-site-contact" required>
            {TEAM_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
          </Field>
          {error ? <p className="em" role="alert">{error}</p> : null}
          <div><Button type="submit" disabled={busy}>{t('create')}</Button></div>
        </form>
      </Dialog>
      {typeof open === 'object' && open ? (
        <Dialog open onClose={() => setOpen(null)} title={t('removeTitle', { name: open.remove.name })} closeLabel={t('cancel')}>
          <p>{t('removeBody')}</p>
          {error ? <p className="em" role="alert">{error}</p> : null}
          <Button disabled={busy} onClick={() => { const target = open.remove; void run(async () => { await remove(target.customerId); setOpen(null); setMessage(t('removed', { name: target.name })); }); }}>{t('confirmRemove')}</Button>
        </Dialog>
      ) : null}
      {issued ? <TeamPasswordDialog name={issued.name} password={issued.password} onDone={() => setIssued(null)} /> : null}
    </>
  );
}
