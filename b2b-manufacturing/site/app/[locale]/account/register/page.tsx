import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { RegisterForm } from '@/components/auth/RegisterForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.register' });
  return { title: t('pageTitle'), robots: { index: false } };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.register');
  return <AuthPageShell title={t('pageTitle')} lead={t('lead')} wide><RegisterForm /></AuthPageShell>;
}
