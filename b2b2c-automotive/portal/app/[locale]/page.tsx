import { getTranslations, setRequestLocale } from 'next-intl/server';

// Placeholder signed-out page. R replaces it with the redirect on to sign-in and the shell.
export default async function SignedOutPlaceholder({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common');
  return (
    <main className="grid min-h-screen place-items-center bg-bg-page p-800">
      <section className="w-full max-w-widget-desktop-4col rounded-400 bg-bg-surface p-800 shadow-card">
        <p className="text-caption-1 text-text-subdued">{t('appName')}</p>
        <h1 className="mt-200 text-h5 font-semibold text-text">{t('placeholder')}</h1>
        <p className="mt-200 text-body-2 text-text-subdued">{t('signedOut')}</p>
      </section>
    </main>
  );
}
