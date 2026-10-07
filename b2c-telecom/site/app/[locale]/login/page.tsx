import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';
import { firstParam, returnTargetOf, type RawSearchParams } from '@/lib/auth/search-params';
import { isSupportedLocale } from '@/lib/utils';

// Session-specific and never indexed: rendered on every request (the page reads `searchParams`).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('login.title'), robots: { index: false, follow: false } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const query = await searchParams;
  return (
    <AuthCard title={t('login.title')} subtitle={t('login.subtitle')}>
      <LoginForm returnTo={returnTargetOf(query, locale)} resetDone={firstParam(query.reset) === '1'} />
    </AuthCard>
  );
}
