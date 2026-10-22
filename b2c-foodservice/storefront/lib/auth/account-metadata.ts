import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/** The tabs of the account area that have a label in `account.tabs`. */
export type AccountTab = 'orders' | 'collection' | 'subscriptions' | 'saved' | 'addresses' | 'payments' | 'reviews' | 'profile' | 'settings';

const PRIVATE: Metadata['robots'] = { index: false, follow: false };

/**
 * `generateMetadata` for one account tab: a document title ("Orders: my account", WCAG 2.4.2) and `noindex`. Every account
 * page is per person and also disallowed in robots.txt; the meta tag covers a crawler that ignores it.
 */
export function accountMetadata(tab: AccountTab) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    const [t, tTabs] = [await getTranslations({ locale, namespace: 'account' }), await getTranslations({ locale, namespace: 'account.tabs' })];
    return { title: t('pageTitle', { tab: tTabs(tab) }), robots: PRIVATE };
  };
}

/** The same for one order: "Order MC-1001: my account". */
export async function accountOrderMetadata({ params }: { params: Promise<{ locale: string; orderNumber: string }> }): Promise<Metadata> {
  const { locale, orderNumber } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('orderPageTitle', { number: decodeURIComponent(orderNumber) }), robots: PRIVATE };
}
