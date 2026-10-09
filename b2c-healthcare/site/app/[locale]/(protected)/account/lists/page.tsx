import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountHeading } from '@/components/account/AccountShell';
import { ListsIndex } from '@/components/lists/ListsIndex';
import { listLists } from '@/lib/ct/shopping-lists';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('lists');
  return pageMetadata({ locale, path: '/account/lists', title: t('metaTitle'), noindex: true });
}

/** `/account/lists`: the signed-in customer's saved lists ("My medicines"); read by customer id, nobody else's list can appear. */
export default async function ListsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', '/account/lists');
  if (!gate.signedIn) return gate.prompt;
  const t = await getTranslations('lists');
  const lists = await listLists(gate.customerId, locale).catch(() => null);
  return (
    <>
      <AccountHeading title={t('title')} sub={t('sub')} />
      <ListsIndex lists={lists} />
    </>
  );
}
