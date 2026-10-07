import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListsIndex } from '@/components/account/ListsIndex';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { requireCustomerPage } from '@/lib/auth/guard';
import { isLocale } from '@/lib/config/markets';
import { getLists } from '@/lib/ct/lists';
import type { SavedList } from '@/lib/types';

// Session-specific: read on every request, never cached, never indexed.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.lists' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ListsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const { customer } = await requireCustomerPage(locale, '/account/lists');
  const t = await getTranslations({ locale, namespace: 'account' });

  let lists: SavedList[] | null = null;
  try {
    lists = await getLists(customer.id);
  } catch (error) {
    console.error('[account] lists unavailable', error instanceof Error ? error.name : 'unknown');
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title'), href: '/account' }, { label: t('lists.title') }]} />
        <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{t('lists.title')}</h1>
      </header>
      {lists === null ? (
        <p role="status" className="m-0 rounded-xl border border-border bg-neutral-50 p-5 text-md text-text-muted">
          {t('lists.unavailable')}
        </p>
      ) : (
        <ListsIndex initial={lists} />
      )}
    </div>
  );
}
