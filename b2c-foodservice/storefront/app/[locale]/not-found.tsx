import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <div>
      <h1>{t('notFoundTitle')}</h1>
      <p>{t('notFoundBody')}</p>
    </div>
  );
}
