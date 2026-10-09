import { getTranslations } from 'next-intl/server';
import { LinkButton } from '@/components/ui/Button';
import { ROUTES } from '@/lib/site';

export default async function LocaleNotFound() {
  const t = await getTranslations('errors');
  return (
    <section className="s"><div className="wrap">
      <h1>{t('notFoundTitle')}</h1>
      <p style={{ margin: '16px 0 24px' }}>{t('notFoundBody')}</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <LinkButton href={ROUTES.plumbing} variant="outline">{t('browsePlumbing')}</LinkButton>
        <LinkButton href={ROUTES.waste} variant="outline">{t('browseWaste')}</LinkButton>
        <LinkButton href={ROUTES.quote}>{t('requestQuote')}</LinkButton>
      </div>
    </div></section>
  );
}
