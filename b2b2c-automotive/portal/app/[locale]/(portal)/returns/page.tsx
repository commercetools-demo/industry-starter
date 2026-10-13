import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { ReturnsPage } from '@/components/returns/ReturnsPage';
import { viewerCan } from '@/lib/portal/viewer';

// Returns (workstream V): both roles may read the list; recording, moving and refunding are Admin only (the routes check again).
export default async function ReturnsRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('returns.view'))) return <Forbidden />;
  const t = await getTranslations('returns');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ReturnsPage />
    </div>
  );
}
