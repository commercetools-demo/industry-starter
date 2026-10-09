'use client';
import { useTranslations } from 'next-intl';
import { Button, LinkButton } from '@/components/ui/Button';
import { ROUTES } from '@/lib/site';

/** Route error boundary. Shows no technical detail; the digest stays in the server log. */
export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <section className="s"><div className="wrap">
      <h1>{t('title')}</h1>
      <p style={{ margin: '16px 0 24px' }}>{t('body')}</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Button onClick={reset}>{t('retry')}</Button>
        <LinkButton href={ROUTES.plumbing} variant="outline">{t('browsePlumbing')}</LinkButton>
        <LinkButton href={ROUTES.waste} variant="outline">{t('browseWaste')}</LinkButton>
        <LinkButton href={ROUTES.quote} variant="outline">{t('requestQuote')}</LinkButton>
      </div>
    </div></section>
  );
}
