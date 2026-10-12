import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ContentTabs } from '@/components/contentools/ContentTabs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';

/** Content (workstream U-08): header and the two tabs. Admin only; the proxy checks the role again for every editor call. */
export default async function ContentLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('content.view'))) return <Forbidden />;
  const t = await getTranslations('content');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ContentTabs />
      {children}
    </div>
  );
}
