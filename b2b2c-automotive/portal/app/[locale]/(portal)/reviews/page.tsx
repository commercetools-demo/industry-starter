import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { ReviewsPage } from '@/components/reviews/ReviewsPage';
import { viewerCan } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

// Reviews (workstream V): both roles may read; replying and hiding are Admin only (the routes check again).
export default async function ReviewsRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('reviews.view'))) return <Forbidden />;
  const t = await getTranslations('reviews');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ReviewsPage />
    </div>
  );
}

export const generateMetadata = titleOf(['nav.items', 'reviews']);
