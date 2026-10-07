import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListDetail } from '@/components/account/ListDetail';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { requireCustomerPage } from '@/lib/auth/guard';
import { isLocale, marketFromLocale } from '@/lib/config/markets';
import { getList, ListNotFoundError } from '@/lib/ct/lists';
import type { SavedListDetail } from '@/lib/types';

// Session-specific: read on every request, never cached, never indexed.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.lists' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ListPage({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const { customer } = await requireCustomerPage(locale, `/account/lists/${encodeURIComponent(id)}`);
  const t = await getTranslations({ locale, namespace: 'account' });

  // The id from the URL is only a request for one of THIS customer's lists: a foreign or unknown id is the same 404.
  let list: SavedListDetail | null = null;
  let missing = false;
  try {
    list = await getList(customer.id, id, marketFromLocale(locale));
  } catch (error) {
    if (error instanceof ListNotFoundError) missing = true;
    else console.error('[account] list unavailable', error instanceof Error ? error.name : 'unknown');
  }
  if (missing) notFound();

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <Breadcrumb
          items={[
            { label: t('home'), href: '/' },
            { label: t('title'), href: '/account' },
            { label: t('lists.title'), href: '/account/lists' },
            { label: list?.name ?? t('lists.title') },
          ]}
        />
      </header>
      {list === null ? (
        <p role="status" className="m-0 rounded-xl border border-border bg-neutral-50 p-5 text-md text-text-muted">
          {t('lists.unavailable')}
        </p>
      ) : (
        <ListDetail initial={list} />
      )}
    </div>
  );
}
