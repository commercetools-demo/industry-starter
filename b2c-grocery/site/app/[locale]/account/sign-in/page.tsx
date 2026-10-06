import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { SignInForm } from '@/components/auth/SignInForm';
import { Link } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signInTitle') };
}

/** `?redirect=` is passed on unchanged; the form validates it with `safeRedirectPath` before using it. */
export default async function SignInPage({
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
    <AuthCard
      title={t('signInTitle')}
      footer={
        <>
          <Link href="/account/forgot-password">{t('forgotLink')}</Link>
          <Link href={`/account/register${query}`}>{t('registerLink')}</Link>
        </>
      }
    >
      <SignInForm redirect={target} />
    </AuthCard>
  );
}
