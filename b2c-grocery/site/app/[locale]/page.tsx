import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('common');
  return <main>{t('brand')}</main>;
}
