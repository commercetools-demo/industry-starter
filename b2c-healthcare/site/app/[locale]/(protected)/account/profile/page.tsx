import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountHeading } from '@/components/account/AccountShell';
import { ProfileForms } from '@/components/account/ProfileForms';
import { RequireSignIn } from '@/components/layout/RequireSignIn';

import { getCustomerById } from '@/lib/ct/identity';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.profile');
  return pageMetadata({ locale, path: '/account/profile', title: t('title'), noindex: true });
}

// Name and password only (no notification settings, photo or family accounts). The email is shown, not
// editable here: changing it would de-verify the account. Rendered inside the account shell.
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', '/account/profile');
  if (!gate.signedIn) return gate.prompt;
  const [customer, t] = await Promise.all([getCustomerById(gate.customerId), getTranslations('account.profile')]);
  // The account was deleted while the cookie lives on: treat it as signed out.
  if (!customer) return <RequireSignIn reason="account" returnTo="/account/profile" />;
  return (
    <>
      <AccountHeading title={t('title')} sub={t('sub')} />
      <ProfileForms firstName={customer.firstName ?? ''} lastName={customer.lastName ?? ''} email={customer.email} />
    </>
  );
}
