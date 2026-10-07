import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { firstParam, type RawSearchParams } from '@/lib/auth/search-params';
import { validatePasswordToken } from '@/lib/ct/customer';
import { isSupportedLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  // The token is in the URL: never send it on as a Referer, never index the page.
  return { title: t('reset.title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/**
 * Checks the token WITHOUT consuming it. A missing, unknown, expired or used token renders the expired state on this same page
 * (an inline "send a new link" form, no redirect to login). The token is never logged.
 */
export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const token = firstParam((await searchParams).token) ?? '';
  const customer = token ? await validatePasswordToken(token) : null;

  if (!customer) {
    return (
      <AuthCard title={t('reset.expiredTitle')} subtitle={t('reset.expiredBody')}>
        <ForgotPasswordForm submitKey="reset.sendNew" />
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t('reset.title')}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
