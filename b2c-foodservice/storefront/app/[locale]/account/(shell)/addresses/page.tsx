import { setRequestLocale } from 'next-intl/server';
import AddressesTab from '@/components/account/AddressesTab';
import { requireCustomerPage } from '@/lib/auth/require-customer';
import { accountMetadata } from '@/lib/auth/account-metadata';

export const dynamic = 'force-dynamic';
export const generateMetadata = accountMetadata('addresses');

/** Account, Addresses tab. */
export default async function AccountAddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/addresses');
  return <AddressesTab />;
}
