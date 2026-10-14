import { setRequestLocale } from 'next-intl/server';
import { DemoLogin } from '@/components/auth/DemoLogin';
import { SignInForm } from '@/components/auth/SignInForm';
import { redirect } from '@/i18n/routing';
import { isDemoLoginEnabled, isOnscreenResetEnabled, safeNextPath } from '@/lib/portal/flags';
import { getPortalSession } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

export default async function SignInPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string | string[] }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getPortalSession();
  if (session.customerId) redirect({ href: session.pending ? '/pending-approval' : '/', locale });
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw) ?? undefined;
  // The picker is rendered only when demo login is on; in production the element is not in the HTML.
  return <SignInForm next={next} resetEnabled={isOnscreenResetEnabled()} demo={isDemoLoginEnabled() ? <DemoLogin /> : undefined} />;
}

export const generateMetadata = titleOf(['auth.signIn', 'title']);
