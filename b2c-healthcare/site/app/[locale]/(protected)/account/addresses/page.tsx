import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AddressBook } from '@/components/account/AddressBook';
import { PageHead } from '@/components/ui/PageHead';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.addresses');
  return pageMetadata({ locale, path: '/account/addresses', title: t('title'), noindex: true });
}

// Signed-out visitors never get here: the (protected) layout shows the sign-in prompt instead. Temporary plain
// frame until workstream R builds the account shell (R-02 moves this page inside it).
export default async function AddressesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account.addresses');
  return (
    <>
      <PageHead title={t('title')} />
      <div className="mx-auto max-w-content px-5 py-8 nav:px-8">
        <AddressBook />
      </div>
    </>
  );
}
