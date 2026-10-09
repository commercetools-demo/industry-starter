'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button, LinkButton } from '@/components/ui/Button';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { useQuoteList } from '@/hooks/useQuoteList';
import { QUOTE_LIST_NOTICE_COOKIE } from '@/lib/quote/constants';
import { ROUTES } from '@/lib/site';
import { QuoteLines } from './QuoteLines';
import { useLineEditor } from './useLineEditor';
import './quote.css';

/** Reads and clears the cookie the locale switch sets when it started the list again in the other currency. */
function useRebuiltNotice(rebuilt: boolean | undefined): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (document.cookie.split('; ').some((c) => c.startsWith(`${QUOTE_LIST_NOTICE_COOKIE}=`))) {
      document.cookie = `${QUOTE_LIST_NOTICE_COOKIE}=; path=/; max-age=0`;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a cookie, which only exists in the browser (the page shell is static)
      setSeen(true);
    }
  }, []);
  return seen || Boolean(rebuilt);
}

/** The table is client-rendered (the page shell is static, D20). Services only: no price, total, discount, delivery or payment control. */
export function QuoteListPage() {
  const t = useTranslations('quoteList');
  const { list, isLoading, failed, reload } = useQuoteList();
  const [announce, setAnnounce] = useState('');
  const editor = useLineEditor((message, name) => setAnnounce(message === 'removed' ? t('removed', { name }) : t('updated')));
  const notice = useRebuiltNotice(list.rebuilt);
  const available = list.lines.filter((l) => l.available !== false).length;

  if (isLoading) return <div aria-busy="true" aria-label={t('loading')} role="status">{[0, 1, 2].map((i) => <div key={i} className="ql-skeleton" />)}</div>;
  if (failed) return <div className="ql-empty" role="alert"><p>{t('loadError')}</p><Button variant="outline" onClick={() => void reload()}>{t('retry')}</Button></div>;

  return (
    <>
      {notice ? <p className="alert" role="status" data-testid="rebuilt-notice" style={{ marginBottom: 24 }}>{t('rebuilt')}</p> : null}
      <LiveRegion>{announce}</LiveRegion>
      {list.count === 0 ? (
        <div className="ql-empty" data-testid="quote-list-empty">
          <p>{t('empty')}</p>
          <div className="row"><LinkButton href={ROUTES.plumbing}>{t('browsePlumbing')}</LinkButton><LinkButton variant="outline" href={ROUTES.waste}>{t('browseWaste')}</LinkButton></div>
        </div>
      ) : (
        <div className="ql-grid">
          <div>
            <QuoteLines lines={list.lines} {...editor} />
            {editor.error ? <p className="em" role="alert" style={{ marginTop: 12 }}>{t('updateError')}</p> : null}
          </div>
          <aside className="ql-card" aria-labelledby="ql-summary">
            <h2 id="ql-summary">{t('summaryTitle')}</h2>
            <p>{t('services', { count: list.count })}</p>
            <p>{t('sites')}</p>
            {available > 0 ? <LinkButton href={{ pathname: ROUTES.quote, query: { from: 'list' } }}>{t('continue')}</LinkButton> : <Button disabled>{t('continue')}</Button>}
            <LinkButton variant="outline" href={ROUTES.plumbing}>{t('addAnother')}</LinkButton>
            <p style={{ fontSize: 14, color: 'var(--fg2)' }}>{t('noPayment')}</p>
          </aside>
        </div>
      )}
    </>
  );
}
