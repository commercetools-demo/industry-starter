import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/** Rendered instead of a page the signed-in role may not open (for example a Buyer opening Store settings by URL). */
export function Forbidden() {
  const t = useTranslations('forbidden');
  return (
    <section role="alert" className="max-w-widget-desktop-8col rounded-200 bg-bg-surface p-600 shadow-card">
      <h1 className="text-h5 font-semibold text-text">{t('title')}</h1>
      <p className="mt-200 text-body-1 text-text-subdued">{t('body')}</p>
      <Link href="/" className="mt-400 inline-flex h-1100 items-center rounded-300 bg-bg-brand px-450 text-body-2 font-bold text-text-on hover:bg-bg-brand-hover">
        {t('back')}
      </Link>
    </section>
  );
}
