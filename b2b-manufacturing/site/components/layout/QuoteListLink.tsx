'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useQuoteList } from '@/hooks/useQuoteList';
import { ROUTES } from '@/lib/site';

/** Appears only when the list has services. The slot is always rendered (hidden, not removed), so nothing shifts when it fills. */
export function QuoteListLink() {
  const t = useTranslations('chrome');
  const { count } = useQuoteList();
  const empty = count === 0;
  return (
    <span className="ql" data-empty={empty} aria-hidden={empty || undefined}>
      <Link href={ROUTES.quoteList} tabIndex={empty ? -1 : undefined}>{t('quoteList', { count })}</Link>
    </span>
  );
}
