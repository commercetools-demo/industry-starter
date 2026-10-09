'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { Link } from '@/i18n/routing';
import { cancelQuoteRequest, sendQuoteAction, useQuote, type QuoteAction } from '@/hooks/useQuotes';
import { KEY_QUOTES } from '@/lib/cache-keys';
import { SendError } from '@/lib/fetcher';
import type { QuoteLine, QuoteRound } from '@/lib/portal/types';
import { ROUTES } from '@/lib/site';
import { formatDate } from './Overview';
import { formatMoney, StatusBadge } from './QuotesStatus';

type Dialogs = 'accept' | 'decline' | 'renegotiate' | 'cancel' | null;

const pre = { whiteSpace: 'pre-wrap' } as const;

function Lines({ lines, prices, total, caption, locale }: { lines: QuoteLine[]; prices: boolean; total?: QuoteRound['total']; caption: string; locale: string }) {
  const t = useTranslations('portal.quotes');
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('service')}</th><th scope="col">{t('quantity')}</th><th scope="col">{t('frequency')}</th><th scope="col">{t('note')}</th>
            {prices ? <><th scope="col">{t('unitPrice')}</th><th scope="col">{t('lineTotal')}</th></> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.name}-${index}`}>
              <td>{line.name}</td><td>{line.quantity}</td><td>{line.frequency ?? ''}</td><td style={pre}>{line.note ?? ''}</td>
              {prices ? <><td>{line.unitPrice ? formatMoney(line.unitPrice, locale) : ''}</td><td>{line.total ? formatMoney(line.total, locale) : ''}</td></> : null}
            </tr>
          ))}
        </tbody>
        {prices && total ? <tfoot><tr><th scope="row" colSpan={5} style={{ textAlign: 'right' }}>{t('total')}</th><td><strong>{formatMoney(total, locale)}</strong></td></tr></tfoot> : null}
      </table>
    </div>
  );
}

/** One thread: lines, prices only once a quote exists, the seller's comment and the actions the role may take (absent otherwise). */
export function QuotesDetail({ id }: { id: string }) {
  const t = useTranslations('portal.quotes');
  const locale = useLocale();
  const { mutate: refreshAll } = useSWRConfig();
  const { thread, isLoading, failed, mutate } = useQuote(id);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(kind: Exclude<Dialogs, null>, form?: HTMLFormElement) {
    if (!thread || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const res = kind === 'cancel' ? await cancelQuoteRequest(thread.id) : await sendQuoteAction(thread.quoteId!, kind as QuoteAction, form ? String(new FormData(form).get('comment') ?? '') : undefined);
      await mutate(res, { revalidate: false });
      await refreshAll((key) => Array.isArray(key) && key[0] === KEY_QUOTES);
      setDialog(null);
      setMessage(t({ accept: 'acceptedMsg', decline: 'declinedMsg', renegotiate: 'askedMsg', cancel: 'cancelledMsg' }[kind]));
    } catch (e) {
      setError(e instanceof SendError ? e.message : t('failed'));
      if (e instanceof SendError && e.status === 409) { await mutate(); setDialog(null); }
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p role="status">{t('loading')}</p>;
  if (failed || !thread) return <><p className="em" role="alert">{t('loadFailed')}</p><p><Link href={`${ROUTES.account}/quotes`}>{t('back')}</Link></p></>;

  const { can } = thread;
  const hasQuote = thread.history.length > 0;
  const noControls = thread.status === 'ready' && !can.accept && !can.decline && !can.renegotiate;
  const latest = thread.history[thread.history.length - 1];

  return (
    <>
      <p style={{ marginBottom: 16 }}><Link href={`${ROUTES.account}/quotes`}>{t('back')}</Link></p>
      <h1 style={{ marginBottom: 8 }}>{thread.reference}</h1>
      <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
        <StatusBadge status={thread.status} />
        <span>{t('requestedOn', { date: thread.createdAt ? formatDate(thread.createdAt) : '' })}</span>
        {thread.site ? <span>{thread.site}</span> : null}
      </p>
      <LiveRegion>{message}</LiveRegion>
      {message ? <p className="alert" role="presentation" style={{ marginBottom: 16 }}>{message}</p> : null}
      {error && !dialog ? <p className="em" role="alert" style={{ marginBottom: 16 }}>{error}</p> : null}
      {thread.expired && thread.validTo ? <p className="alert" style={{ marginBottom: 16 }}>{t('expired', { date: formatDate(thread.validTo) })}</p> : null}

      <Lines lines={thread.lines} prices={hasQuote} total={latest?.total} caption={t('detailCaption')} locale={locale} />
      {!hasQuote ? <p className="hint" style={{ marginTop: 12 }}>{t('noPrices')}</p> : null}
      {thread.comment ? <section style={{ marginTop: 24 }}><h2 style={{ font: '600 20px/1.2 var(--font-display)', marginBottom: 8 }}>{t('yourNote')}</h2><p style={pre}>{thread.comment}</p></section> : null}

      {hasQuote ? (
        <section style={{ marginTop: 32 }} aria-labelledby="quote-history">
          <h2 id="quote-history" style={{ font: '600 20px/1.2 var(--font-display)', marginBottom: 12 }}>{t('history')}</h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
            {thread.history.map((round, index) => (
              <li key={round.quoteId} className="card"><div className="b">
                <h3 style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>{t('round', { n: index + 1 })} <StatusBadge status={round.status} /></h3>
                <p className="hint">{t('issuedOn', { date: formatDate(round.createdAt) })}{round.validTo ? ` · ${t('validTo', { date: formatDate(round.validTo) })}` : ''}</p>
                {round.sellerComment ? <div><strong>{t('sellerComment')}</strong><p style={pre}>{round.sellerComment}</p></div> : null}
                {round.buyerComment ? <div><strong>{t('yourQuestion')}</strong><p style={pre}>{round.buyerComment}</p></div> : null}
              </div></li>
            ))}
          </ol>
        </section>
      ) : null}

      {noControls ? <p className="hint" style={{ marginTop: 24 }}>{t('readOnly')}</p> : null}
      {can.accept || can.decline || can.renegotiate || can.cancel ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
          {can.accept ? <Button onClick={() => setDialog('accept')}>{t('accept')}</Button> : null}
          {can.decline ? <Button variant="outline" onClick={() => setDialog('decline')}>{t('decline')}</Button> : null}
          {can.renegotiate ? <Button variant="outline" onClick={() => setDialog('renegotiate')}>{t('renegotiate')}</Button> : null}
          {can.cancel ? <Button variant="outline" onClick={() => setDialog('cancel')}>{t('cancelRequest')}</Button> : null}
        </div>
      ) : null}

      {(['accept', 'decline', 'cancel'] as const).map((kind) => (
        <Dialog key={kind} open={dialog === kind} onClose={() => setDialog(null)} title={t(`${kind}Title`)} closeLabel={t('notNow')}>
          <p>{t(`${kind}Body`)}</p>
          {error ? <p className="em" role="alert">{error}</p> : null}
          <Button disabled={busy} onClick={() => run(kind)}>{t(kind === 'accept' ? 'confirmAccept' : kind === 'decline' ? 'confirmDecline' : 'confirmCancel')}</Button>
        </Dialog>
      ))}
      <Dialog open={dialog === 'renegotiate'} onClose={() => setDialog(null)} title={t('renegotiateTitle')} closeLabel={t('notNow')}>
        <form onSubmit={(event) => { event.preventDefault(); void run('renegotiate', event.currentTarget); }} style={{ display: 'grid', gap: 16 }}>
          <Field as="textarea" label={t('questionLabel')} name="comment" required maxLength={2000} />
          {error ? <p className="em" role="alert">{error}</p> : null}
          <div><Button type="submit" disabled={busy}>{t('send')}</Button></div>
        </form>
      </Dialog>
    </>
  );
}
