import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountHeading } from '@/components/account/AccountShell';
import { ListDetail } from '@/components/lists/ListDetail';
import { getListView } from '@/lib/ct/list-view';
import { getOwnList } from '@/lib/ct/shopping-lists';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { rxContextOf } from '@/lib/rx-route';
import { pageMetadata } from '@/lib/seo';
import { getSession } from '@/lib/session';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('lists');
  // The list name is the patient's own text: it never goes into the title or the URL.
  return pageMetadata({ locale, path: '/account/lists', title: t('metaTitle'), noindex: true });
}

/** `/account/lists/[id]`: one list. A foreign and an unknown id are the same 404 inside the account shell. */
export default async function ListPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', `/account/lists/${encodeURIComponent(id)}`);
  if (!gate.signedIn) return gate.prompt;
  const list = await getOwnList(id, gate.customerId);
  if (!list) notFound();
  const view = await getListView(list, rxContextOf(await getSession()));
  return (
    <>
      <AccountHeading title={view.name} />
      <ListDetail list={view} />
    </>
  );
}
