import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <main>
      <h1>{t('notFoundTitle')}</h1>
      <p>{t('notFoundBody')}</p>
    </main>
  );
}
