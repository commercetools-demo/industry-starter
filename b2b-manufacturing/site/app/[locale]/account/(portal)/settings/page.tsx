import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SettingsForms } from '@/components/portal/SettingsForms';
import { getSession } from '@/lib/session';
import { getProfile } from '@/lib/ct/profile';

export const metadata: Metadata = { robots: { index: false } };

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, session] = await Promise.all([getTranslations('portal.settings'), getSession(locale)]);
  const initial = await getProfile(session.customerId!);
  return (
    <>
      <h1 style={{ marginBottom: 24 }}>{t('title')}</h1>
      <SettingsForms initial={initial} />
    </>
  );
}
