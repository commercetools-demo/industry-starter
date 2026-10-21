import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');
  return (
    <div>
      <p>{t('placeholder')}</p>
    </div>
  );
}
