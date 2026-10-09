import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { TeamFirstSignIn } from '@/components/portal/TeamFirstSignIn';
import { mustChangePassword } from '@/lib/ct/team-password';
import { redirect } from '@/i18n/routing';
import { getSession } from '@/lib/session';
import { ROUTES } from '@/lib/site';

export const metadata: Metadata = { robots: { index: false } };

/** First sign-in of an invited colleague. Dynamic (reads the session). Anyone who has nothing to change goes on to the portal. */
export default async function ChangePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession(locale);
  if (!session.customerId) redirect({ href: ROUTES.signIn, locale });
  else if (!(await mustChangePassword(session.customerId))) redirect({ href: ROUTES.account, locale });
  const t = await getTranslations('portal.team.firstSignIn');
  return <AuthPageShell title={t('title')} lead={t('intro')}><TeamFirstSignIn /></AuthPageShell>;
}
