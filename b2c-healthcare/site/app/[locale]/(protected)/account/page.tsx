import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OverviewView } from '@/components/account/OverviewView';
import { RequireSignIn } from '@/components/layout/RequireSignIn';
import { AccountGoneError, getOverview } from '@/lib/ct/account-summary';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.overview');
  return pageMetadata({ locale, path: '/account', title: t('title'), noindex: true });
}

/**
 * Overview (account-dashboard). Resolved per request for the session customer; each summary settles on its own
 * (`getOverview`), so a service that is down shows an inline "couldn't load" and the rest still renders.
 */
export default async function AccountOverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', '/account');
  if (!gate.signedIn) return gate.prompt;
  let overview;
  try {
    overview = await getOverview(gate.customerId);
  } catch (error) {
    // The account was deleted while the cookie lives on: treat it as signed out.
    if (error instanceof AccountGoneError) overview = null;
    else throw error;
  }
  if (!overview) return <RequireSignIn reason="account" returnTo="/account" />;
  return <OverviewView overview={overview} />;
}
