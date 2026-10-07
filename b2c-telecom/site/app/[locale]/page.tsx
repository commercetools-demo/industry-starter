import { getTranslations, setRequestLocale } from 'next-intl/server';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <main>
      <h1>{t('common.brand')}</h1>
      <p>{t('home.placeholder')}</p>
    </main>
  );
}
