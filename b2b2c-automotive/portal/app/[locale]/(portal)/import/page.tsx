import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImportPage, type ImportTab } from '@/components/import/ImportPage';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

const TABS: readonly string[] = ['add', 'csv', 'local'];

// Product import (workstream W): `?tab=add|csv|local` and `?key=` (the Brand partnership page links to `?tab=local&key=<product key>`).
export default async function ImportRoute({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string; key?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('import.run'))) return <Forbidden />;
  const { tab, key } = await searchParams;
  const [tn, t] = await Promise.all([getTranslations('nav.items'), getTranslations('importPage')]);
  const initialTab = (tab && TABS.includes(tab) ? tab : 'add') as ImportTab;
  const highlightKey = key && /^[A-Za-z0-9_.-]{1,200}$/.test(key) ? key : undefined;
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={tn('import')} subtitle={t('subtitle')} />
      <ImportPage initialTab={initialTab} highlightKey={highlightKey} />
    </div>
  );
}

export const generateMetadata = titleOf(['nav.items', 'import']);
