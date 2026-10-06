import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('resetTitle') };
}

/** The token travels in the query (`?token=`); it is never stored or logged by the app. */
export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  const { token } = await searchParams;
  return (
    <AuthCard title={t('resetTitle')}>
      <ResetPasswordForm token={typeof token === 'string' && token ? token : undefined} />
    </AuthCard>
  );
}
