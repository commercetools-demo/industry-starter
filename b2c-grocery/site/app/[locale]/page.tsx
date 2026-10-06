import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('common');
  // The locale layout already renders <main>.
  return <div>{t('brand')}</div>;
}
