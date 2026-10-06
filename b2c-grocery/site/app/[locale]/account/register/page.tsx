import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Link } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('registerTitle') };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  const { redirect } = await searchParams;
  const target = typeof redirect === 'string' ? redirect : undefined;
  const query = target ? `?redirect=${encodeURIComponent(target)}` : '';
  return (
    <AuthCard title={t('registerTitle')} footer={<Link href={`/account/sign-in${query}`}>{t('signInLinkLong')}</Link>}>
      <RegisterForm redirect={target} />
    </AuthCard>
  );
}
