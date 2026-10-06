import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSession } from '@/lib/session';

/**
 * Everything under this group needs a signed-in session (pages from R, S, T, V live here). Anonymous visitors are
 * sent to sign-in with the path they asked for in `?redirect=` (`x-pathname` is set by `proxy.ts`).
 * This guards the pages only: data routes must still check `session.customerId` themselves.
 */
export default async function ProtectedAccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const path = (await headers()).get('x-pathname') ?? `/${locale}/account`;
  // redirect() throws; it must stay outside any try/catch.
  if (!session.customerId) redirect({ href: `/account/sign-in?redirect=${encodeURIComponent(path)}`, locale });
  return <>{children}</>;
}
