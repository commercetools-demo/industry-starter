import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { PortalShell } from '@/components/portal/PortalShell';
import { redirect } from '@/i18n/routing';
import { mustChangePassword } from '@/lib/ct/team-password';
import { getSession } from '@/lib/session';
import { PATH_HEADER, ROUTES } from '@/lib/site';

/** Every portal page has a title and is kept out of search results; a page can set a more specific title. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal' });
  return { title: `${t('navLabel')} | Malva`, robots: { index: false, follow: false } };
}

/** Dynamic on purpose: reads the session. No session sends the visitor to sign-in and back (`next`). Never cached (G: no-store). */
export default async function PortalLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession(locale);
  if (!session.customerId) {
    const path = (await headers()).get(PATH_HEADER) ?? ROUTES.account;
    redirect({ href: `${ROUTES.signIn}?next=${encodeURIComponent(path)}`, locale });
  }
  // An invited colleague still holds the administrator's one-time password: nothing in the portal until they have chosen their own (workstream S).
  if (await mustChangePassword(session.customerId!)) redirect({ href: '/account/change-password', locale });
  return <PortalShell firstName={session.customerFirstName ?? ''}>{children}</PortalShell>;
}
