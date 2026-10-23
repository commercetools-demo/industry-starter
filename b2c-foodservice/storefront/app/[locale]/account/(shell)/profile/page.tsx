import { setRequestLocale } from 'next-intl/server';
import PasswordForm from '@/components/account/PasswordForm';
import ProfileForm from '@/components/account/ProfileForm';
import { requireCustomerPage } from '@/lib/auth/require-customer';
import { accountMetadata } from '@/lib/auth/account-metadata';

export const dynamic = 'force-dynamic';
export const generateMetadata = accountMetadata('profile');

/** Account, Profile tab: the profile card and the password change. */
export default async function AccountProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/profile');
  return (
    <>
      <ProfileForm />
      <PasswordForm />
    </>
  );
}
