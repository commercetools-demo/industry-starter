import { getTranslations, setRequestLocale } from 'next-intl/server';

// Placeholder home page so /<locale> renders; the real home is built in workstream H.
export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common');
  return (
    <main>
      <h1>{t('brand')}</h1>
    </main>
  );
}
