import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CustomersPage } from '@/components/customers/CustomersPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

// Customers (workstream V): the reseller's own shoppers. Admin only; every route checks the role and the store again on the server.
export default async function CustomersRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('customers.view'))) return <Forbidden />;
  const t = await getTranslations('customers');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CustomersPage />
    </div>
  );
}

export const generateMetadata = titleOf(['nav.items', 'customers']);
