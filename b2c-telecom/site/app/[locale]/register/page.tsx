import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { returnTargetOf, type RawSearchParams } from '@/lib/auth/search-params';
import { isSupportedLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('register.title'), robots: { index: false, follow: false } };
}

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <AuthCard title={t('register.title')}>
      <RegisterForm returnTo={returnTargetOf(await searchParams, locale)} />
    </AuthCard>
  );
}
