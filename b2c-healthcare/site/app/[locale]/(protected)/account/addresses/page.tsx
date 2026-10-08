import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AddressBook } from '@/components/account/AddressBook';
import { AccountHeading } from '@/components/account/AccountShell';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.addresses');
  return pageMetadata({ locale, path: '/account/addresses', title: t('title'), noindex: true });
}

// Signed-out visitors never get here: the (protected) layout shows the sign-in prompt instead. Rendered inside the
// account shell (`account/layout.tsx`).
export default async function AddressesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account.addresses');
  return (
    <>
      <AccountHeading title={t('title')} />
      <AddressBook />
    </>
  );
}
