'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { useSites } from '@/hooks/useSites';
import { SendError } from '@/lib/fetcher';
import type { Site, SiteInput } from '@/lib/portal/types';

type Open = { kind: 'form'; site?: Site } | { kind: 'remove'; site: Site } | null;
const COUNTRIES = ['US', 'DE'] as const;

function SiteForm({ site, onSubmit, error, busy }: { site?: Site; onSubmit: (input: SiteInput) => void; error: string; busy: boolean }) {
  const t = useTranslations('portal.sites');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(Object.fromEntries(new FormData(event.currentTarget).entries()) as unknown as SiteInput);
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <Field label={t('nameLabel')} name="name" defaultValue={site?.name} required maxLength={100} />
      <Field label={t('streetName')} name="streetName" defaultValue={site?.streetName} required autoComplete="off" maxLength={150} />
      <Field label={t('city')} name="city" defaultValue={site?.city} required maxLength={100} />
      <Field label={t('postalCode')} name="postalCode" defaultValue={site?.postalCode} required maxLength={20} />
      <Field as="select" label={t('country')} name="country" defaultValue={site?.country ?? 'US'} required>
        {COUNTRIES.map((c) => <option key={c} value={c}>{t(`countries.${c}`)}</option>)}
      </Field>
      <Field label={t('contactName')} name="contactName" defaultValue={site?.contactName} maxLength={100} />
      <Field label={t('contactPhone')} name="phone" type="tel" defaultValue={site?.phone} maxLength={40} />
      {error ? <p className="em" role="alert">{error}</p> : null}
      <div><Button type="submit" disabled={busy}>{t('save')}</Button></div>
    </form>
  );
}

/** Company sites (Business Unit addresses). Administrators add, edit, remove and choose the default; everyone else sees a read-only table. */
export function SitesManager() {
  const t = useTranslations('portal.sites');
  const { sites, canEdit, isLoading, failed, add, update, remove, makeDefault } = useSites();
  const [open, setOpen] = useState<Open>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await work();
      setOpen(null);
      setMessage(done);
    } catch (e) {
      setError(e instanceof SendError ? e.message : t('failed'));
    } finally {
      setBusy(false);
    }
  }

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
          {canEdit ? <p style={{ marginBottom: 16 }}><Button onClick={() => { setError(''); setOpen({ kind: 'form' }); }}>{t('add')}</Button></p> : <p className="hint" style={{ marginBottom: 16 }}>{t('readOnly')}</p>}
          {sites.length === 0 ? <div className="card"><div className="b"><p>{t('empty')}</p></div></div> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <caption className="sr-only">{t('caption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('name')}</th><th scope="col">{t('address')}</th><th scope="col">{t('contact')}</th>
                    {canEdit ? <th scope="col"><span className="sr-only">{t('actions')}</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.key}>
                      <td>{site.name} {site.isDefault ? <span className="tag">{t('defaultTag')}</span> : null}</td>
                      <td>{site.streetName}, {site.postalCode} {site.city}, {t(`countries.${site.country as 'US' | 'DE'}`)}</td>
                      <td>{[site.contactName, site.phone].filter(Boolean).join(' · ')}</td>
                      {canEdit ? (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', gap: 8 }}>
                            <Button small variant="outline" aria-label={t('editAria', { name: site.name })} onClick={() => { setError(''); setOpen({ kind: 'form', site }); }}>{t('edit')}</Button>
                            {!site.isDefault ? <Button small variant="outline" aria-label={t('makeDefaultAria', { name: site.name })} disabled={busy} onClick={() => run(() => makeDefault(site.key), t('defaultSet', { name: site.name }))}>{t('makeDefault')}</Button> : null}
                            <Button small variant="outline" aria-label={t('removeAria', { name: site.name })} onClick={() => { setError(''); setOpen({ kind: 'remove', site }); }}>{t('remove')}</Button>
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      <Dialog open={open?.kind === 'form'} onClose={() => setOpen(null)} title={open?.kind === 'form' && open.site ? t('editTitle') : t('addTitle')} closeLabel={t('cancel')}>
        {open?.kind === 'form' ? (
          <SiteForm
            key={open.site?.key ?? 'new'} site={open.site} error={error} busy={busy}
            onSubmit={(input) => { const target = open.site; void run(() => (target ? update(target.key, input) : add(input)), t('saved')); }}
          />
        ) : null}
      </Dialog>
      <Dialog open={open?.kind === 'remove'} onClose={() => setOpen(null)} title={t('removeTitle')} closeLabel={t('cancel')}>
        {open?.kind === 'remove' ? (
          <>
            <p>{t('removeBody', { name: open.site.name })}</p>
            {error ? <p className="em" role="alert">{error}</p> : null}
            <Button disabled={busy} onClick={() => { const target = open.site; void run(() => remove(target.key), t('removed')); }}>{t('confirmRemove')}</Button>
          </>
        ) : null}
      </Dialog>
    </>
  );
}
