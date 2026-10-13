import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { SubscriptionsPage } from '@/components/subscriptions/SubscriptionsPage';
import { viewerCan } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

// Subscriptions (workstream V): recurring orders of the store with pause, resume, skip and cancel. Admin only.
export default async function SubscriptionsRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('subscriptions.view'))) return <Forbidden />;
  const t = await getTranslations('subscriptions');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <SubscriptionsPage />
    </div>
  );
}

export const generateMetadata = titleOf(['nav.items', 'subscriptions']);
